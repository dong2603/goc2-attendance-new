import os
import glob
import re
import sqlite3
import pandas as pd
import calendar
from datetime import datetime
from db import get_db_connection, init_db

# Ensure DB path exists
init_db()

def clean_date_str(val):
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (datetime, pd.Timestamp)):
        return val.strftime("%Y-%m-%d")
    val_str = str(val).strip()
    if not val_str or val_str.lower() in ("nan", "nat", "null"):
        return None
    # Check YYYY-MM-DD format
    match = re.match(r"(\d{4}-\d{2}-\d{2})", val_str)
    if match:
        return match.group(1)
    return val_str

def parse_excel_file(file_path):
    filename = os.path.basename(file_path)
    # Extract Year and Month from filename
    match = re.search(r"(\d{4})년\s*_\s*(\d{1,2})월", filename)
    if not match:
        match = re.search(r"(\d{4})년\s*(\d{1,2})월", filename)
    if not match:
        print(f"Skipping file {filename}: Cannot extract year and month.")
        return
    
    year = int(match.group(1))
    month = int(match.group(2))
    print(f"\nProcessing {filename} ({year} Year, {month} Month)...")
    
    xl = pd.ExcelFile(file_path)
    
    # Identify sheet names
    attendance_sheet = None
    contact_sheet = None
    
    for sheet in xl.sheet_names:
        if re.search(r"\d{4}\.\d{1,2}", sheet):
            attendance_sheet = sheet
        elif "연락처" in sheet or "근무" in sheet or "정보" in sheet or "ٹ" in sheet:
            contact_sheet = sheet

    if not attendance_sheet:
        attendance_sheet = xl.sheet_names[0]
        
    if len(xl.sheet_names) > 1 and not contact_sheet:
        contact_sheet = xl.sheet_names[1]

    print(f"Attendance Sheet: {attendance_sheet}, Contact Sheet: {contact_sheet}")
    
    # 1. Parse Attendance Sheet
    df_att = pd.read_excel(file_path, sheet_name=attendance_sheet, header=None)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get number of days in this month
    _, num_days = calendar.monthrange(year, month)
    print(f"Days in month: {num_days}")
    
    employees_inserted = 0
    attendance_inserted = 0
    
    for idx, row in df_att.iterrows():
        row_vals = row.tolist()
        if len(row_vals) < 8:
            continue
            
        # Check if first column (index 1) is a valid sequence number (digit)
        # Row layout: Col 0: NaN/None, Col 1: Seq No (1, 2, 3...), Col 2: Name
        seq_val = row_vals[1]
        if pd.isna(seq_val):
            continue
            
        try:
            # Check if seq_val can be parsed as integer (sequence number)
            seq_num = int(float(seq_val))
        except ValueError:
            # Not a numeric sequence row, skip
            continue
            
        # Extract employee info
        name = row_vals[2]
        if pd.isna(name) or str(name).strip() == "" or "합계" in str(name) or "평균" in str(name):
            continue
        name = str(name).strip()
        
        # Emp No in Col 4
        emp_no_val = row_vals[4]
        if pd.isna(emp_no_val):
            continue
        emp_no = str(int(float(emp_no_val))).strip()
        
        # Join date in Col 5, Retire date in Col 6
        join_date = clean_date_str(row_vals[5])
        retire_date = clean_date_str(row_vals[6])
        
        # Insert or update employee
        cursor.execute("""
        INSERT INTO employees (name, emp_no, join_date, retire_date)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(emp_no) DO UPDATE SET
            name = excluded.name,
            join_date = COALESCE(excluded.join_date, employees.join_date),
            retire_date = COALESCE(excluded.retire_date, employees.retire_date)
        """, (name, emp_no, join_date, retire_date))
        
        # Get employee ID
        cursor.execute("SELECT id FROM employees WHERE emp_no = ?", (emp_no,))
        employee_id = cursor.fetchone()[0]
        employees_inserted += 1
        
        # Attendance values start at Col 7 for Day 1
        for day in range(1, num_days + 1):
            col_idx = 7 + day - 1
            if col_idx >= len(row_vals):
                break
                
            status = row_vals[col_idx]
            if pd.isna(status):
                status = "/" # Default weekend/empty mark
            else:
                status = str(status).strip()
                
            date_str = f"{year:04d}-{month:02d}-{day:02d}"
            
            cursor.execute("""
            INSERT INTO attendance (employee_id, date, status)
            VALUES (?, ?, ?)
            ON CONFLICT(employee_id, date) DO UPDATE SET
                status = excluded.status
            """, (employee_id, date_str, status))
            attendance_inserted += 1
            
    conn.commit()
    print(f"Synced {employees_inserted} employees and {attendance_inserted} attendance records.")
    
    # 2. Parse Contact Sheet
    if contact_sheet:
        try:
            df_contact = pd.read_excel(file_path, sheet_name=contact_sheet, header=None)
            contacts_synced = 0
            
            for idx, row in df_contact.iterrows():
                row_vals = row.tolist()
                if len(row_vals) < 4:
                    continue
                
                # Check sequence number in Col 1
                seq_val = row_vals[1]
                if pd.isna(seq_val):
                    continue
                try:
                    int(float(seq_val))
                except ValueError:
                    continue
                
                # Extract contact details
                name = row_vals[2]
                if pd.isna(name) or str(name).strip() == "":
                    continue
                name = str(name).strip()
                
                email = str(row_vals[3]).strip() if pd.notna(row_vals[3]) else None
                phone = str(row_vals[4]).strip() if pd.notna(row_vals[4]) else None
                
                # Update contact details
                cursor.execute("""
                UPDATE employees
                SET email = COALESCE(?, email),
                    phone = COALESCE(?, phone)
                WHERE name = ?
                """, (email, phone, name))
                contacts_synced += 1
                
            conn.commit()
            print(f"Synced {contacts_synced} contact details.")
        except Exception as e:
            print(f"Error parsing contact sheet: {e}")
            
    conn.close()

def sync_all():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    search_path = os.path.join(base_dir, "*.xlsx")
    files = glob.glob(search_path)
    print(f"Syncing {len(files)} files...")
    for f in files:
        try:
            parse_excel_file(f)
        except Exception as e:
            print(f"Error syncing {f}: {e}")
    print("All sync completed!")

if __name__ == "__main__":
    sync_all()
