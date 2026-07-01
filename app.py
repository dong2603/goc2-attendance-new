import os
from flask import Flask, request, jsonify, send_from_directory, render_template_string
from db import get_db_connection
from sync import sync_all
from datetime import datetime

app = Flask(__name__, static_folder="static", static_url_path="/static")

@app.after_request
def add_header(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Create directories for static assets if they don't exist
os.makedirs(os.path.join(app.root_path, "static", "css"), exist_ok=True)
os.makedirs(os.path.join(app.root_path, "static", "js"), exist_ok=True)

# Helper function to convert sqlite3.Row to dict
def row_to_dict(row):
    return dict(row) if row else None

@app.route("/")
def index():
    # Simple direct entry html, we'll write the actual static index.html later and serve it here
    # Check if index.html exists in root or static, we will place index.html in the root or templates directory.
    # To keep things clean, let's serve a modern SPA from templates or serve the static file.
    # We will read templates/index.html and serve it.
    try:
        with open(os.path.join(app.root_path, "templates", "index.html"), "r", encoding="utf-8") as f:
            content = f.read()
        return render_template_string(content)
    except FileNotFoundError:
        # Fallback if templates/index.html is not created yet
        return "<h1>직원 근태 관리 시스템 API 서버 작동 중</h1><p>프론트엔드 리소스가 준비되지 않았습니다.</p>"

# 1. Get Employee List
@app.route("/api/employees", methods=["GET"])
def get_employees():
    q = request.args.get("q", "").strip()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if q:
        cursor.execute("""
            SELECT * FROM employees 
            WHERE name LIKE ? OR emp_no LIKE ?
            ORDER BY name ASC
        """, (f"%{q}%", f"%{q}%"))
    else:
        cursor.execute("SELECT * FROM employees ORDER BY name ASC")
        
    rows = cursor.fetchall()
    conn.close()
    
    return jsonify([row_to_dict(r) for r in rows])

# 2. Add New Employee
@app.route("/api/employees", methods=["POST"])
def add_employee():
    data = request.json
    name = data.get("name", "").strip()
    emp_no = data.get("emp_no", "").strip()
    join_date = data.get("join_date", "").strip() or None
    retire_date = data.get("retire_date", "").strip() or None
    email = data.get("email", "").strip() or None
    phone = data.get("phone", "").strip() or None
    
    if not name or not emp_no:
        return jsonify({"error": "성명과 사번은 필수 항목입니다."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO employees (name, emp_no, join_date, retire_date, email, phone)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (name, emp_no, join_date, retire_date, email, phone))
        conn.commit()
        new_id = cursor.lastrowid
        cursor.execute("SELECT * FROM employees WHERE id = ?", (new_id,))
        emp = row_to_dict(cursor.fetchone())
        return jsonify(emp), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "이미 존재하는 사번입니다."}), 400
    finally:
        conn.close()

# 3. Update Employee Info
@app.route("/api/employees/<int:emp_id>", methods=["PUT"])
def update_employee(emp_id):
    data = request.json
    name = data.get("name", "").strip()
    join_date = data.get("join_date", "").strip() or None
    retire_date = data.get("retire_date", "").strip() or None
    email = data.get("email", "").strip() or None
    phone = data.get("phone", "").strip() or None
    
    if not name:
        return jsonify({"error": "성명은 필수 항목입니다."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM employees WHERE id = ?", (emp_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"error": "존재하지 않는 직원입니다."}), 404
        
    cursor.execute("""
        UPDATE employees
        SET name = ?, join_date = ?, retire_date = ?, email = ?, phone = ?
        WHERE id = ?
    """, (name, join_date, retire_date, email, phone, emp_id))
    conn.commit()
    
    cursor.execute("SELECT * FROM employees WHERE id = ?", (emp_id,))
    emp = row_to_dict(cursor.fetchone())
    conn.close()
    
    return jsonify(emp)

# 4. Get Employee Details & Attendance
@app.route("/api/employees/<int:emp_id>/attendance", methods=["GET"])
def get_employee_attendance(emp_id):
    year = request.args.get("year")
    month = request.args.get("month")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verify employee exists
    cursor.execute("SELECT * FROM employees WHERE id = ?", (emp_id,))
    employee = row_to_dict(cursor.fetchone())
    if not employee:
        conn.close()
        return jsonify({"error": "존재하지 않는 직원입니다."}), 404
        
    # Define attendance status categories to track
    statuses = ["출근", "재택", "연차", "반차", "결근", "공가", "교육", "지각"]
    
    # Get total accumulated counts for each status
    cursor.execute("""
        SELECT status, COUNT(*) 
        FROM attendance 
        WHERE employee_id = ? 
        GROUP BY status
    """, (emp_id,))
    total_rows = cursor.fetchall()
    total_stats = {s: 0 for s in statuses}
    for row in total_rows:
        status_name = row[0]
        count = row[1]
        if status_name in total_stats:
            total_stats[status_name] = count
        elif status_name == "공가" or status_name == "교육":
            # Just in case other codes exist, but we have defined them in statuses
            pass
            
    # Get attendance history
    query = "SELECT * FROM attendance WHERE employee_id = ?"
    params = [emp_id]
    
    if year and month:
        date_pattern = f"{int(year):04d}-{int(month):02d}-%"
        query += " AND date LIKE ?"
        params.append(date_pattern)
        
    query += " ORDER BY date ASC"
    
    cursor.execute(query, params)
    attendance_rows = cursor.fetchall()
    
    # Calculate counts for the selected month
    month_stats = {s: 0 for s in statuses}
    for r in attendance_rows:
        status_name = r["status"]
        if status_name in month_stats:
            month_stats[status_name] += 1
            
    conn.close()
    
    return jsonify({
        "employee": employee,
        "attendance": [row_to_dict(r) for r in attendance_rows],
        "total_stats": total_stats,
        "month_stats": month_stats
    })



# 5. Save/Update Attendance status
@app.route("/api/attendance", methods=["POST"])
def update_attendance():
    data = request.json
    employee_id = data.get("employee_id")
    date_str = data.get("date", "").strip()
    status = data.get("status", "").strip()
    
    if not employee_id or not date_str or not status:
        return jsonify({"error": "직원 ID, 날짜 및 근태 상태는 필수 항목입니다."}), 400
        
    # Validate date format
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)."}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if employee exists
    cursor.execute("SELECT id FROM employees WHERE id = ?", (employee_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"error": "존재하지 않는 직원입니다."}), 404
        
    # Upsert attendance
    cursor.execute("""
        INSERT INTO attendance (employee_id, date, status)
        VALUES (?, ?, ?)
        ON CONFLICT(employee_id, date) DO UPDATE SET
            status = excluded.status
    """, (employee_id, date_str, status))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "employee_id": employee_id, "date": date_str, "status": status})

# 6. Trigger Excel Sync manually
@app.route("/api/sync", methods=["POST"])
def trigger_sync():
    try:
        sync_all()
        return jsonify({"success": True, "message": "성공적으로 동기화되었습니다."})
    except Exception as e:
        return jsonify({"error": f"동기화 중 오류가 발생했습니다: {str(e)}"}), 500

# 7. Dashboard Stats
@app.route("/api/stats", methods=["GET"])
def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Total Employees
    cursor.execute("SELECT COUNT(*) FROM employees WHERE retire_date IS NULL OR retire_date = ''")
    active_employees_count = cursor.fetchone()[0]
    
    # Today's Date / Latest Date
    cursor.execute("SELECT MAX(date) FROM attendance")
    max_date_row = cursor.fetchone()
    latest_date_in_db = max_date_row[0] if max_date_row[0] else datetime.now().strftime("%Y-%m-%d")
    
    # Available Months list
    cursor.execute("SELECT DISTINCT substr(date, 1, 7) as month FROM attendance ORDER BY month DESC")
    available_months = [row["month"] for row in cursor.fetchall() if row["month"]]
    
    # Get month query parameter
    requested_month = request.args.get("month", "").strip()
    if requested_month in available_months:
        selected_month = requested_month
    elif available_months:
        selected_month = available_months[0]
    else:
        selected_month = datetime.now().strftime("%Y-%m")
        
    # Monthly Attendance Trends (last 6 months with data)
    cursor.execute("""
        SELECT substr(date, 1, 7) as month, status, COUNT(*) as count
        FROM attendance
        GROUP BY month, status
        ORDER BY month DESC
        LIMIT 100
    """)
    trend_rows = cursor.fetchall()
    
    # Process trend data
    trends = {}
    for r in trend_rows:
        m = r["month"]
        st = r["status"]
        cnt = r["count"]
        if m not in trends:
            trends[m] = {}
        trends[m][st] = cnt

    # Total Late Ranking (count > 0)
    cursor.execute("""
        SELECT e.name, e.emp_no, COUNT(a.id) as count
        FROM employees e
        JOIN attendance a ON e.id = a.employee_id
        WHERE a.status = '지각' AND (e.retire_date IS NULL OR e.retire_date = '')
        GROUP BY e.id
        HAVING count > 0
        ORDER BY count DESC
    """)
    total_late_ranking = [dict(row) for row in cursor.fetchall()]

    # Monthly Late Ranking (for selected_month, count > 0)
    cursor.execute("""
        SELECT e.name, e.emp_no, COUNT(a.id) as count
        FROM employees e
        JOIN attendance a ON e.id = a.employee_id
        WHERE a.status = '지각' AND substr(a.date, 1, 7) = ? AND (e.retire_date IS NULL OR e.retire_date = '')
        GROUP BY e.id
        HAVING count > 0
        ORDER BY count DESC
    """, (selected_month,))
    monthly_late_ranking = [dict(row) for row in cursor.fetchall()]
        
    conn.close()
    
    return jsonify({
        "total_employees": active_employees_count,
        "stats_date": latest_date_in_db,
        "monthly_trends": trends,
        "total_late_ranking": total_late_ranking,
        "monthly_late_ranking": monthly_late_ranking,
        "selected_month": selected_month,
        "available_months": available_months
    })

# 8. Upload Excel file and sync data
@app.route("/api/upload", methods=["POST"])
def upload_excel():
    if "file" not in request.files:
        return jsonify({"error": "업로드할 파일이 없습니다."}), 400
        
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "선택된 파일명이 비어 있습니다."}), 400
        
    if not file.filename.endswith(".xlsx"):
        return jsonify({"error": "엑셀 파일(.xlsx)만 업로드할 수 있습니다."}), 400
        
    # Save file to temporary path
    temp_dir = os.path.join(app.root_path, "uploads")
    os.makedirs(temp_dir, exist_ok=True)
    
    temp_filepath = os.path.join(temp_dir, file.filename)
    file.save(temp_filepath)
    
    try:
        from sync import parse_excel_file
        parse_excel_file(temp_filepath)
        return jsonify({"success": True, "message": f"'{file.filename}' 파일의 데이터가 성공적으로 동기화되었습니다."})
    except Exception as e:
        return jsonify({"error": f"엑셀 파일 처리 중 오류가 발생했습니다: {str(e)}"}), 500
    finally:
        if os.path.exists(temp_filepath):
            try:
                os.remove(temp_filepath)
            except Exception:
                pass

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

