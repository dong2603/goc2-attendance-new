// Global Application State
const state = {
    employees: [],
    selectedEmployee: null,
    currentView: 'dashboard', // 'dashboard' or 'detail'
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    attendanceData: {}, // Map of date -> status for selected employee
    trendChart: null,
    ratioChart: null,
    totalStats: {},
    monthStats: {}
};

// DOM Elements
const elements = {
    employeeList: document.getElementById('employeeList'),
    employeeSearchInput: document.getElementById('employeeSearchInput'),
    syncExcelBtn: document.getElementById('syncExcelBtn'),
    addEmployeeBtn: document.getElementById('addEmployeeBtn'),
    dashboardView: document.getElementById('dashboardView'),
    detailView: document.getElementById('detailView'),
    backToDashboardBtn: document.getElementById('backToDashboardBtn'),
    
    // Stats elements
    statsDateText: document.getElementById('statsDateText'),
    
    // Profile elements
    detailAvatar: document.getElementById('detailAvatar'),
    detailName: document.getElementById('detailName'),
    detailEmpNo: document.getElementById('detailEmpNo'),
    detailJoinDate: document.getElementById('detailJoinDate'),
    detailRetireDate: document.getElementById('detailRetireDate'),
    retireDateContainer: document.getElementById('retireDateContainer'),
    detailEmail: document.getElementById('detailEmail'),
    detailPhone: document.getElementById('detailPhone'),
    attendanceStatsGrid: document.getElementById('attendanceStatsGrid'),
    detailTotalLates: document.getElementById('detailTotalLates'),
    detailMonthLates: document.getElementById('detailMonthLates'),
    editEmployeeBtn: document.getElementById('editEmployeeBtn'),
    
    // Calendar elements
    calendarGrid: document.getElementById('calendarGrid'),
    currentMonthDisplay: document.getElementById('currentMonthDisplay'),
    prevMonthBtn: document.getElementById('prevMonthBtn'),
    nextMonthBtn: document.getElementById('nextMonthBtn'),
    
    // Add Employee Modal
    addEmployeeModal: document.getElementById('addEmployeeModal'),
    saveNewEmployeeBtn: document.getElementById('saveNewEmployeeBtn'),
    addEmployeeForm: document.getElementById('addEmployeeForm'),
    
    // Edit Employee Modal
    editEmployeeModal: document.getElementById('editEmployeeModal'),
    saveEditEmployeeBtn: document.getElementById('saveEditEmployeeBtn'),
    editEmployeeForm: document.getElementById('editEmployeeForm'),
    
    // Attendance Modal
    editAttendanceModal: document.getElementById('editAttendanceModal'),
    attModalDate: document.getElementById('attModalDate'),
    attModalName: document.getElementById('attModalName'),
    statusSelectGrid: document.getElementById('statusSelectGrid'),
    
    // Toast
    toastMessage: document.getElementById('toastMessage'),

    // Excel Upload Modal
    openUploadModalBtn: document.getElementById('openUploadModalBtn'),
    uploadExcelModal: document.getElementById('uploadExcelModal'),
    excelFileInput: document.getElementById('excelFileInput'),
    submitExcelUploadBtn: document.getElementById('submitExcelUploadBtn'),
    lateMonthSelect: document.getElementById('lateMonthSelect'),

    // Auth Screen Elements
    authOverlay: document.getElementById('authOverlay'),
    accessPasswordInput: document.getElementById('accessPasswordInput'),
    loginSubmitBtn: document.getElementById('loginSubmitBtn'),
    authErrorMsg: document.getElementById('authErrorMsg')
};

// Init Application
document.addEventListener('DOMContentLoaded', () => {
    try {
        checkExistingAuth();
        setupEventListeners();
    } catch (e) {
        alert("근태 시스템 자바스크립트 초기화 에러:\n" + e.message + "\n" + e.stack);
    }
});

// Check if user is already authenticated via sessionStorage
function checkExistingAuth() {
    const savedPassword = sessionStorage.getItem('accessPassword');
    if (savedPassword === '801300') {
        elements.authOverlay.style.display = 'none';
        fetchEmployees();
        fetchStats();
    } else {
        elements.authOverlay.style.display = 'flex';
        elements.accessPasswordInput.focus();
    }
}

// Handle login attempt
function handleLogin() {
    const password = elements.accessPasswordInput.value.trim();
    if (password === '801300') {
        sessionStorage.setItem('accessPassword', password);
        elements.authOverlay.style.display = 'none';
        showToast('보안 인증에 성공했습니다.');
        fetchEmployees();
        fetchStats();
    } else {
        const card = document.querySelector('.auth-card');
        card.classList.add('shake');
        elements.authErrorMsg.style.display = 'block';
        elements.accessPasswordInput.value = '';
        elements.accessPasswordInput.focus();
        
        setTimeout(() => {
            card.classList.remove('shake');
        }, 500);
    }
}

// Toast notification helper
function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    if (type === 'error') {
        elements.toastMessage.style.borderColor = '#ef4444';
    } else {
        elements.toastMessage.style.borderColor = 'var(--accent)';
    }
    elements.toastMessage.classList.add('show');
    setTimeout(() => {
        elements.toastMessage.classList.remove('show');
    }, 3000);
}

// Modal open/close helpers
window.openModal = function(modalId) {
    document.getElementById(modalId).style.display = 'flex';
};

window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
};

// API Calls
async function fetchEmployees(searchQuery = '') {
    try {
        const response = await fetch(`/api/employees?q=${encodeURIComponent(searchQuery)}`);
        if (!response.ok) throw new Error('직원 정보를 불러오지 못했습니다.');
        state.employees = await response.json();
        renderEmployeeList();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function fetchStats(selectedMonth = '') {
    try {
        const url = '/api/stats' + (selectedMonth ? `?month=${selectedMonth}` : '');
        const response = await fetch(url);
        if (!response.ok) throw new Error('통계 데이터를 불러오지 못했습니다.');
        const stats = await response.json();
        renderDashboard(stats);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function fetchEmployeeAttendance(employeeId, year, month) {
    try {
        const response = await fetch(`/api/employees/${employeeId}/attendance?year=${year}&month=${month}`);
        if (!response.ok) throw new Error('근태 정보를 불러오지 못했습니다.');
        const data = await response.json();
        
        state.selectedEmployee = data.employee;
        state.attendanceData = {};
        state.totalStats = data.total_stats || {};
        state.monthStats = data.month_stats || {};
        
        // Map attendance list into an object of date -> status
        data.attendance.forEach(att => {
            state.attendanceData[att.date] = att.status;
        });
        
        renderEmployeeProfile();
        renderCalendar();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Login Submit Button Click
    elements.loginSubmitBtn.addEventListener('click', handleLogin);
    
    // Login Input Enter Key Press
    elements.accessPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });

    // Lateness Month Selector change
    elements.lateMonthSelect.addEventListener('change', (e) => {
        fetchStats(e.target.value);
    });

    // Search input typing
    elements.employeeSearchInput.addEventListener('input', (e) => {
        fetchEmployees(e.target.value);
    });

    // Excel Sync button
    elements.syncExcelBtn.addEventListener('click', async () => {
        elements.syncExcelBtn.disabled = true;
        elements.syncExcelBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 동기화 중...';
        
        try {
            const response = await fetch('/api/sync', { method: 'POST' });
            const result = await response.json();
            if (response.ok) {
                showToast(result.message || '성공적으로 동기화되었습니다.');
                fetchEmployees();
                fetchStats();
            } else {
                throw new Error(result.error || '동기화 중 오류가 발생했습니다.');
            }
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            elements.syncExcelBtn.disabled = false;
            elements.syncExcelBtn.innerHTML = '<i class="fa-solid fa-sync"></i> 동기화';
        }
    });

    // Open Upload Excel Modal
    elements.openUploadModalBtn.addEventListener('click', () => {
        elements.excelFileInput.value = '';
        openModal('uploadExcelModal');
    });

    // Submit Excel File Upload
    elements.submitExcelUploadBtn.addEventListener('click', async () => {
        const fileInput = elements.excelFileInput;
        if (fileInput.files.length === 0) {
            showToast('엑셀 파일을 선택해주세요.', 'error');
            return;
        }
        
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        
        elements.submitExcelUploadBtn.disabled = true;
        elements.submitExcelUploadBtn.textContent = '업로드 중...';
        
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            if (response.ok) {
                showToast(result.message || '엑셀 파일이 성공적으로 동기화되었습니다.');
                closeModal('uploadExcelModal');
                fetchEmployees();
                fetchStats();
            } else {
                throw new Error(result.error || '엑셀 업로드 실패');
            }
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            elements.submitExcelUploadBtn.disabled = false;
            elements.submitExcelUploadBtn.textContent = '파일 업로드';
        }
    });

    // Add Employee Button
    elements.addEmployeeBtn.addEventListener('click', () => {
        elements.addEmployeeForm.reset();
        openModal('addEmployeeModal');
    });

    // Save New Employee
    elements.saveNewEmployeeBtn.addEventListener('click', async () => {
        const name = document.getElementById('newEmpName').value.trim();
        const emp_no = document.getElementById('newEmpNo').value.trim();
        const join_date = document.getElementById('newJoinDate').value;
        const email = document.getElementById('newEmail').value.trim();
        const phone = document.getElementById('newPhone').value.trim();

        if (!name || !emp_no) {
            showToast('성명과 사번은 필수 입력 사항입니다.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, emp_no, join_date, email, phone })
            });
            const result = await response.json();
            
            if (response.ok) {
                showToast('새 직원이 등록되었습니다.');
                closeModal('addEmployeeModal');
                fetchEmployees();
                fetchStats();
            } else {
                throw new Error(result.error || '직원 등록에 실패했습니다.');
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    // Edit Employee Profile Button
    elements.editEmployeeBtn.addEventListener('click', () => {
        if (!state.selectedEmployee) return;
        
        document.getElementById('editEmpId').value = state.selectedEmployee.id;
        document.getElementById('editEmpName').value = state.selectedEmployee.name;
        document.getElementById('editEmpNo').value = state.selectedEmployee.emp_no;
        document.getElementById('editJoinDate').value = state.selectedEmployee.join_date || '';
        document.getElementById('editRetireDate').value = state.selectedEmployee.retire_date || '';
        document.getElementById('editEmail').value = state.selectedEmployee.email || '';
        document.getElementById('editPhone').value = state.selectedEmployee.phone || '';
        
        openModal('editEmployeeModal');
    });

    // Save Edited Profile
    elements.saveEditEmployeeBtn.addEventListener('click', async () => {
        const id = document.getElementById('editEmpId').value;
        const name = document.getElementById('editEmpName').value.trim();
        const join_date = document.getElementById('editJoinDate').value;
        const retire_date = document.getElementById('editRetireDate').value;
        const email = document.getElementById('editEmail').value.trim();
        const phone = document.getElementById('editPhone').value.trim();

        if (!name) {
            showToast('성명은 필수 입력 사항입니다.', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/employees/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, join_date, retire_date, email, phone })
            });
            const result = await response.json();
            
            if (response.ok) {
                showToast('직원 정보가 수정되었습니다.');
                closeModal('editEmployeeModal');
                state.selectedEmployee = result;
                fetchEmployees();
                renderEmployeeProfile();
            } else {
                throw new Error(result.error || '정보 수정에 실패했습니다.');
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    // Back to Dashboard Button
    elements.backToDashboardBtn.addEventListener('click', () => {
        switchView('dashboard');
        // Deselect active list item
        const activeItem = document.querySelector('.employee-item.active');
        if (activeItem) activeItem.classList.remove('active');
        state.selectedEmployee = null;
    });

    // Month Selector Buttons
    elements.prevMonthBtn.addEventListener('click', () => {
        state.currentMonth--;
        if (state.currentMonth < 1) {
            state.currentMonth = 12;
            state.currentYear--;
        }
        if (state.selectedEmployee) {
            fetchEmployeeAttendance(state.selectedEmployee.id, state.currentYear, state.currentMonth);
        }
    });

    elements.nextMonthBtn.addEventListener('click', () => {
        state.currentMonth++;
        if (state.currentMonth > 12) {
            state.currentMonth = 1;
            state.currentYear++;
        }
        if (state.selectedEmployee) {
            fetchEmployeeAttendance(state.selectedEmployee.id, state.currentYear, state.currentMonth);
        }
    });

    // Attendance Status Modification Modal Buttons click
    elements.statusSelectGrid.addEventListener('click', async (e) => {
        const btn = e.target.closest('.status-select-btn');
        if (!btn) return;
        
        const dateStr = elements.attModalDate.textContent;
        const status = btn.getAttribute('data-status');
        
        try {
            const response = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: state.selectedEmployee.id,
                    date: dateStr,
                    status: status
                })
            });
            const result = await response.json();
            
            if (response.ok) {
                showToast(`${dateStr} 근태를 [${status}]로 변경했습니다.`);
                closeModal('editAttendanceModal');
                
                // Refresh local attendance state
                state.attendanceData[dateStr] = status;
                fetchEmployeeAttendance(state.selectedEmployee.id, state.currentYear, state.currentMonth);
                fetchStats(); // Update dashboard stats in background
            } else {
                throw new Error(result.error || '근태 수정에 실패했습니다.');
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}

// Switch view helper
function switchView(viewName) {
    state.currentView = viewName;
    if (viewName === 'dashboard') {
        elements.dashboardView.style.display = 'flex';
        elements.detailView.style.display = 'none';
        fetchStats();
    } else {
        elements.dashboardView.style.display = 'none';
        elements.detailView.style.display = 'flex';
    }
}

// Renders
function renderEmployeeList() {
    elements.employeeList.innerHTML = '';
    
    if (state.employees.length === 0) {
        elements.employeeList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary); font-size:13px;">검색 결과가 없습니다.</div>';
        return;
    }
    
    state.employees.forEach(emp => {
        const item = document.createElement('div');
        item.className = 'employee-item';
        if (state.selectedEmployee && state.selectedEmployee.id === emp.id) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div class="emp-info">
                <span class="emp-name">${emp.name}</span>
                <span class="emp-dept">${emp.retire_date ? '퇴사자' : '정상근무'}</span>
            </div>
            <span class="emp-no-badge">${emp.emp_no}</span>
        `;
        
        item.addEventListener('click', () => {
            // Update active state in UI
            document.querySelectorAll('.employee-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            
            // Switch to details
            switchView('detail');
            fetchEmployeeAttendance(emp.id, state.currentYear, state.currentMonth);
        });
        
        elements.employeeList.appendChild(item);
    });
}

function renderDashboard(data) {
    // Stats Date Display
    elements.statsDateText.innerHTML = `기준 일자: <strong>${data.stats_date}</strong> (최종 업데이트 완료)`;
    
    // 2. Render monthly trend chart (Bar/Line)
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    if (state.trendChart) state.trendChart.destroy();
    
    // Sort months
    const months = Object.keys(data.monthly_trends).sort();
    const leaveData = [];
    const lateData = [];
    
    months.forEach(m => {
        const monthStats = data.monthly_trends[m];
        const leave = (monthStats["연차"] || 0) + (monthStats["반차"] || 0);
        const late = monthStats["지각"] || 0;
        
        leaveData.push(leave);
        lateData.push(late);
    });
    
    state.trendChart = new Chart(trendCtx, {
        type: 'bar',
        data: {
            labels: months.map(m => m.replace('-', '년 ') + '월'),
            datasets: [
                {
                    label: '연차/반차 사용량 (일)',
                    data: leaveData,
                    backgroundColor: 'rgba(245, 158, 11, 0.65)',
                    borderColor: '#f59e0b',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: '지각 횟수 (회)',
                    data: lateData,
                    backgroundColor: 'rgba(236, 72, 153, 0.65)',
                    borderColor: '#ec4899',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#f8fafc',
                        font: { family: 'Outfit' }
                    }
                }
            }
        }
    });

    // 3. Render Lateness Rankings (Total and Monthly)
    const totalList = document.getElementById('totalLateRankingList');
    const monthlyList = document.getElementById('monthlyLateRankingList');

    // Populate Monthly Selector options dynamically if not already populated
    if (data.available_months && elements.lateMonthSelect.options.length !== data.available_months.length) {
        elements.lateMonthSelect.innerHTML = '';
        data.available_months.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            const parts = m.split('-');
            opt.textContent = `${parts[0]}년 ${parts[1]}월`;
            elements.lateMonthSelect.appendChild(opt);
        });
    }
    if (data.selected_month) {
        elements.lateMonthSelect.value = data.selected_month;
    }

    // Render Total Late Ranking List (Top 10)
    totalList.innerHTML = '';
    if (!data.total_late_ranking || data.total_late_ranking.length === 0) {
        totalList.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px; font-size: 13px;">지각 기록이 없습니다.</div>';
    } else {
        data.total_late_ranking.forEach((item, index) => {
            const row = document.createElement('div');
            row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);";
            
            // Badge color based on rank
            let badgeBg = "rgba(255,255,255,0.08)";
            let badgeColor = "var(--text-secondary)";
            if (index === 0) { badgeBg = "#ef4444"; badgeColor = "#ffffff"; }
            else if (index === 1) { badgeBg = "#f59e0b"; badgeColor = "#ffffff"; }
            else if (index === 2) { badgeBg = "#3b82f6"; badgeColor = "#ffffff"; }

            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="width: 24px; height: 24px; border-radius: 50%; background: ${badgeBg}; color: ${badgeColor}; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">${index + 1}</span>
                    <span style="font-weight: 600; font-size: 14px;">${item.name}</span>
                    <span style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">(${item.emp_no})</span>
                </div>
                <div style="font-weight: 700; color: #ec4899; font-size: 14px;">${item.count}회</div>
            `;
            totalList.appendChild(row);
        });
    }

    // Render Monthly Late Ranking List (Top 5)
    monthlyList.innerHTML = '';
    if (!data.monthly_late_ranking || data.monthly_late_ranking.length === 0) {
        monthlyList.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px; font-size: 13px;">이달의 지각 기록이 없습니다.</div>';
    } else {
        data.monthly_late_ranking.forEach((item, index) => {
            const row = document.createElement('div');
            row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);";
            
            let badgeBg = "rgba(255,255,255,0.08)";
            let badgeColor = "var(--text-secondary)";
            if (index === 0) { badgeBg = "#ef4444"; badgeColor = "#ffffff"; }
            else if (index === 1) { badgeBg = "#f59e0b"; badgeColor = "#ffffff"; }
            else if (index === 2) { badgeBg = "#3b82f6"; badgeColor = "#ffffff"; }

            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="width: 24px; height: 24px; border-radius: 50%; background: ${badgeBg}; color: ${badgeColor}; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">${index + 1}</span>
                    <span style="font-weight: 600; font-size: 14px;">${item.name}</span>
                    <span style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">(${item.emp_no})</span>
                </div>
                <div style="font-weight: 700; color: #f59e0b; font-size: 14px;">${item.count}회</div>
            `;
            monthlyList.appendChild(row);
        });
    }
}

function renderEmployeeProfile() {
    const emp = state.selectedEmployee;
    if (!emp) return;
    
    elements.detailAvatar.textContent = emp.name.charAt(0);
    elements.detailName.textContent = emp.name;
    elements.detailEmpNo.textContent = emp.emp_no;
    elements.detailJoinDate.textContent = emp.join_date || '-';
    
    if (emp.retire_date) {
        elements.detailRetireDate.textContent = emp.retire_date;
        elements.retireDateContainer.style.display = 'block';
    } else {
        elements.retireDateContainer.style.display = 'none';
    }
    
    elements.detailEmail.textContent = emp.email || '-';
    elements.detailPhone.textContent = emp.phone || '-';
    
    // Render Quick Stats Cards Grid
    elements.attendanceStatsGrid.innerHTML = '';
    const categories = [
        { name: "출근", class: "work" },
        { name: "재택", class: "remote" },
        { name: "연차", class: "leave" },
        { name: "반차", class: "half-leave" },
        { name: "지각", class: "late" },
        { name: "결근", class: "absent" },
        { name: "공가", class: "off" },
        { name: "교육", class: "off" }
    ];
    
    categories.forEach(cat => {
        const totalVal = state.totalStats[cat.name] || 0;
        const monthVal = state.monthStats[cat.name] || 0;
        
        const card = document.createElement('div');
        card.className = `att-stat-mini-card ${cat.class}`;
        card.innerHTML = `
            <div class="att-stat-mini-label">${cat.name}</div>
            <div class="att-stat-mini-month">${monthVal}<span style="font-size:10px; font-weight:normal; margin-left:1px;">회</span></div>
            <div class="att-stat-mini-total">총 ${totalVal}회</div>
        `;
        elements.attendanceStatsGrid.appendChild(card);
    });
    
    // Render late stats in profile details
    elements.detailTotalLates.textContent = state.totalStats["지각"] || 0;
    elements.detailMonthLates.textContent = state.monthStats["지각"] || 0;
}

function renderCalendar() {
    elements.currentMonthDisplay.textContent = `${state.currentYear}.${String(state.currentMonth).padStart(2, '0')}`;
    
    // Clear grid
    elements.calendarGrid.innerHTML = '';
    
    // Add Day headers: Sun Mon Tue Wed Thu Fri Sat
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    weekdays.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        elements.calendarGrid.appendChild(header);
    });
    
    // Get calendar math
    const firstDay = new Date(state.currentYear, state.currentMonth - 1, 1);
    const lastDay = new Date(state.currentYear, state.currentMonth, 0);
    
    const startingDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    // Previous month padding
    const prevMonthLastDay = new Date(state.currentYear, state.currentMonth - 1, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell other-month';
        cell.innerHTML = `<span class="day-number">${prevMonthLastDay - i}</span>`;
        elements.calendarGrid.appendChild(cell);
    }
    
    // Days in current month
    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        
        const dateStr = `${state.currentYear}-${String(state.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const currentDayOfWeek = new Date(state.currentYear, state.currentMonth - 1, day).getDay();
        const isWeekend = (currentDayOfWeek === 0 || currentDayOfWeek === 6);
        
        let status = state.attendanceData[dateStr];
        if (!status && isWeekend) {
            status = '/';
        }
        
        let statusClass = '';
        let displayStatus = status || '';
        
        if (status === '출근') statusClass = 'status-work';
        else if (status === '재택') statusClass = 'status-remote';
        else if (status === '연차') statusClass = 'status-leave';
        else if (status === '반차') statusClass = 'status-half-leave';
        else if (status === '결근') statusClass = 'status-absent';
        else if (status === '지각') statusClass = 'status-late';
        else if (status === '공가' || status === '교육') statusClass = 'status-off';
        else if (status === '/') {
            statusClass = 'status-weekend';
            displayStatus = '휴일';
        }
        
        cell.innerHTML = `
            <span class="day-number" style="${currentDayOfWeek === 0 ? 'color:#f87171;' : currentDayOfWeek === 6 ? 'color:#60a5fa;' : ''}">${day}</span>
            ${status ? `<span class="cell-status-chip ${statusClass}">${displayStatus}</span>` : ''}
        `;
        
        cell.addEventListener('click', () => {
            elements.attModalDate.textContent = dateStr;
            elements.attModalName.textContent = `[${state.selectedEmployee.name}] 직원의 근태 상태를 선택하세요.`;
            
            const btns = elements.statusSelectGrid.querySelectorAll('.status-select-btn');
            btns.forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-status') === (status || '')) {
                    btn.classList.add('active');
                }
            });
            
            openModal('editAttendanceModal');
        });
        
        elements.calendarGrid.appendChild(cell);
    }
}
