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
    statTotalEmployees: document.getElementById('statTotalEmployees'),
    statTodayWork: document.getElementById('statTodayWork'),
    statTodayRemote: document.getElementById('statTodayRemote'),
    statTodayLeave: document.getElementById('statTodayLeave'),
    
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
    openUploadModalBtn: document.getElementById('openUploadModalBtn'),
    uploadExcelModal: document.getElementById('uploadExcelModal'),
    excelFileInput: document.getElementById('excelFileInput'),
    submitExcelUploadBtn: document.getElementById('submitExcelUploadBtn'),
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
    
    // Auth elements
    authOverlay: document.getElementById('authOverlay'),
    accessPasswordInput: document.getElementById('accessPasswordInput'),
    loginSubmitBtn: document.getElementById('loginSubmitBtn'),
    authErrorMsg: document.getElementById('authErrorMsg'),
    
    // Toast
    toastMessage: document.getElementById('toastMessage')
};

// Init Application
document.addEventListener('DOMContentLoaded', () => {
    try {
        setupEventListeners();
        checkExistingAuth();
    } catch (e) {
        alert("근태관리 시스템 초기화 에러:\n" + e.message + "\n" + e.stack);
    }
});

// Authentication Helpers
function getAuthHeader() {
    return {
        'X-Access-Password': sessionStorage.getItem('accessPassword') || ''
    };
}

async function checkExistingAuth() {
    const password = sessionStorage.getItem('accessPassword');
    if (!password) {
        elements.authOverlay.style.display = 'flex';
        return;
    }
    
    try {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        if (response.ok) {
            elements.authOverlay.style.display = 'none';
            fetchEmployees();
            fetchStats();
        } else {
            sessionStorage.removeItem('accessPassword');
            elements.authOverlay.style.display = 'flex';
        }
    } catch (error) {
        sessionStorage.removeItem('accessPassword');
        elements.authOverlay.style.display = 'flex';
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
        const response = await fetch(`/api/employees?q=${encodeURIComponent(searchQuery)}`, {
            headers: getAuthHeader()
        });
        if (response.status === 401) {
            checkExistingAuth();
            return;
        }
        if (!response.ok) throw new Error('직원 정보를 불러오지 못했습니다.');
        state.employees = await response.json();
        renderEmployeeList();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function fetchStats() {
    try {
        const response = await fetch('/api/stats', {
            headers: getAuthHeader()
        });
        if (response.status === 401) {
            checkExistingAuth();
            return;
        }
        if (!response.ok) throw new Error('통계 데이터를 불러오지 못했습니다.');
        const stats = await response.json();
        renderDashboard(stats);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function fetchEmployeeAttendance(employeeId, year, month) {
    try {
        const response = await fetch(`/api/employees/${employeeId}/attendance?year=${year}&month=${month}`, {
            headers: getAuthHeader()
        });
        if (response.status === 401) {
            checkExistingAuth();
            return;
        }
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
    // Search input typing
    elements.employeeSearchInput.addEventListener('input', (e) => {
        fetchEmployees(e.target.value);
    });

    // Excel Sync button
    elements.syncExcelBtn.addEventListener('click', async () => {
        elements.syncExcelBtn.disabled = true;
        elements.syncExcelBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 동기화 중...';
        
        try {
            const response = await fetch('/api/sync', { 
                method: 'POST',
                headers: getAuthHeader()
            });
            if (response.status === 401) {
                checkExistingAuth();
                return;
            }
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

    // Open Upload Modal
    elements.openUploadModalBtn.addEventListener('click', () => {
        document.getElementById('uploadExcelForm').reset();
        openModal('uploadExcelModal');
    });

    // Submit Excel Upload
    elements.submitExcelUploadBtn.addEventListener('click', async () => {
        const fileInput = elements.excelFileInput;
        if (fileInput.files.length === 0) {
            showToast('업로드할 엑셀 파일을 선택해주세요.', 'error');
            return;
        }

        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);

        elements.submitExcelUploadBtn.disabled = true;
        elements.submitExcelUploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 업로드 중...';

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: getAuthHeader(),
                body: formData
            });
            if (response.status === 401) {
                checkExistingAuth();
                return;
            }
            const result = await response.json();

            if (response.ok) {
                showToast(result.message || '파일이 성공적으로 업로드되었습니다.');
                closeModal('uploadExcelModal');
                fetchEmployees();
                fetchStats();
            } else {
                throw new Error(result.error || '파일 업로드에 실패했습니다.');
            }
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            elements.submitExcelUploadBtn.disabled = false;
            elements.submitExcelUploadBtn.innerHTML = '파일 업로드';
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
                headers: {
                    ...getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, emp_no, join_date, email, phone })
            });
            if (response.status === 401) {
                checkExistingAuth();
                return;
            }
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
                headers: {
                    ...getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, join_date, retire_date, email, phone })
            });
            if (response.status === 401) {
                checkExistingAuth();
                return;
            }
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
                headers: {
                    ...getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    employee_id: state.selectedEmployee.id,
                    date: dateStr,
                    status: status
                })
            });
            if (response.status === 401) {
                checkExistingAuth();
                return;
            }
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

    // Login Submit Button Click
    elements.loginSubmitBtn.addEventListener('click', executeLogin);

    // Login Input Enter Key
    elements.accessPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            executeLogin();
        }
    });

    async function executeLogin() {
        const password = elements.accessPasswordInput.value.trim();
        if (!password) {
            showToast('비밀번호를 입력해주세요.', 'error');
            return;
        }

        elements.loginSubmitBtn.disabled = true;
        elements.loginSubmitBtn.textContent = '인증 중...';
        elements.authErrorMsg.style.display = 'none';

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const result = await response.json();

            if (response.ok) {
                sessionStorage.setItem('accessPassword', password);
                elements.authOverlay.style.display = 'none';
                showToast('인증에 성공했습니다.');
                fetchEmployees();
                fetchStats();
            } else {
                throw new Error(result.error || '인증에 실패했습니다.');
            }
        } catch (error) {
            elements.authErrorMsg.textContent = error.message;
            elements.authErrorMsg.style.display = 'block';
            
            // Add shake animation
            const card = document.querySelector('.auth-card');
            card.classList.add('shake');
            setTimeout(() => {
                card.classList.remove('shake');
            }, 500);
        } finally {
            elements.loginSubmitBtn.disabled = false;
            elements.loginSubmitBtn.textContent = '인증 및 접속';
        }
    }
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
    const dateObj = new Date(data.stats_date);
    elements.statsDateText.innerHTML = `기준 일자: <strong>${data.stats_date}</strong> (기록된 가장 최근 근태일)`;
    
    elements.statTotalEmployees.innerHTML = `${data.total_employees} <span class="stat-unit">명</span>`;
    
    // Set counts
    const today = data.today_stats;
    const workCount = (today["출근"] || 0) + (today["지각"] || 0);
    const remoteCount = today["재택"] || 0;
    const leaveCount = (today["연차"] || 0) + (today["반차"] || 0) + (today["공가"] || 0) + (today["교육"] || 0);
    
    elements.statTodayWork.innerHTML = `${workCount} <span class="stat-unit">명</span>`;
    elements.statTodayRemote.innerHTML = `${remoteCount} <span class="stat-unit">명</span>`;
    elements.statTodayLeave.innerHTML = `${leaveCount} <span class="stat-unit">명</span>`;
    
    // 1. Render ratio chart (Doughnut)
    const ratioCtx = document.getElementById('ratioChart').getContext('2d');
    
    if (state.ratioChart) state.ratioChart.destroy();
    
    // Gather all statuses present today
    const labels = Object.keys(today).filter(k => k !== '/');
    const values = labels.map(k => today[k]);
    
    // Palette
    const colors = {
        "출근": "#10b981",
        "재택": "#8b5cf6",
        "연차": "#f59e0b",
        "반차": "#eab308",
        "결근": "#ef4444",
        "공가": "#3b82f6",
        "교육": "#3b82f6",
        "지각": "#ec4899"
    };
    
    const backgroundColors = labels.map(label => colors[label] || '#94a3b8');
    
    if (labels.length === 0) {
        state.ratioChart = new Chart(ratioCtx, {
            type: 'doughnut',
            data: {
                labels: ['데이터 없음'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['rgba(255,255,255,0.05)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    } else {
        state.ratioChart = new Chart(ratioCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: backgroundColors,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#f8fafc',
                            font: { family: 'Outfit' }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }
    
    // 2. Render monthly trend chart (Bar/Line)
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    if (state.trendChart) state.trendChart.destroy();
    
    // Sort months
    const months = Object.keys(data.monthly_trends).sort();
    const workData = [];
    const remoteData = [];
    const leaveData = [];
    
    months.forEach(m => {
        const monthStats = data.monthly_trends[m];
        const work = (monthStats["출근"] || 0) + (monthStats["지각"] || 0);
        const remote = monthStats["재택"] || 0;
        const leave = (monthStats["연차"] || 0) + (monthStats["반차"] || 0) + (monthStats["공가"] || 0) + (monthStats["교육"] || 0);
        
        workData.push(work);
        remoteData.push(remote);
        leaveData.push(leave);
    });
    
    state.trendChart = new Chart(trendCtx, {
        type: 'bar',
        data: {
            labels: months.map(m => m.replace('-', '년 ') + '월'),
            datasets: [
                {
                    label: '출근',
                    data: workData,
                    backgroundColor: 'rgba(16, 185, 129, 0.65)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: '재택',
                    data: remoteData,
                    backgroundColor: 'rgba(139, 92, 246, 0.65)',
                    borderColor: '#8b5cf6',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: '휴가/기타',
                    data: leaveData,
                    backgroundColor: 'rgba(245, 158, 11, 0.65)',
                    borderColor: '#f59e0b',
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
