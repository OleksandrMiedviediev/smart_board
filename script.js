
const MAIN_ROLES = [
    { id: 'box-20', name: 'BOX-20' },
    { id: 'box-60', name: 'BOX-60' },
    { id: 'box-100', name: 'BOX-100' },
    { id: 'flat-a', name: 'FLAT-A' },
    { id: 'flat-c-30', name: 'FLAT-C-30' },
    { id: 'flat-c-60', name: 'FLAT-C-60' },
    { id: 'flat-c-100', name: 'FLAT-C-100' },
    { id: 'boom', name: 'BOOM' },
    { id: 'im', name: 'IM' },
    { id: 'tugger', name: 'TUGGER' },
    { id: 'pit', name: 'PIT' },
    { id: 'indukt', name: 'INDUKT' },
    { id: 'tso-pg', name: 'TSO - PG' },
    { id: 'tso-stacker', name: 'TSO - STACKER' },
    { id: 'audytor', name: 'AUDYTOR' },
    { id: 'cpt-chaser', name: 'CPT CHASER' },
    { id: 'clerk', name: 'CLERK' },
    { id: 'lead', name: 'LEAD' },
    { id: 'ko', name: 'KO' }
];

const OOP_DEPARTMENTS = ['STOW', 'VR', 'ICQA', 'P2R', 'SM', 'PICK', 'TOM', 'DOCK'];

const SPECIAL_ZONES = [
    { id: 'bhp', name: 'BHP' },
    { id: 'szkolenie', name: 'SZKOLENIE' },
    { id: 'spotkanie', name: 'SPOTKANIE' },
    { id: 'xt', name: 'XT' }
];

const ABSENCE_ZONES = [
    { id: 'nn', name: 'N/N' },
    { id: 'urlop', name: 'URLOP' },
    { id: 'l4', name: 'L4' }
];

const STORAGE_KEYS = {
    shifts: 'smartBoard_shifts',
    employees: 'smartBoard_employees',
    assignments: 'smartBoard_assignments',
    meta: 'smartBoard_date_meta',
    scanned: 'smartBoard_scanned'
};

let shifts = [
    { id: 'shift-a', name: 'Zmiana A', color: '#8b5cf6' },
    { id: 'shift-b', name: 'Zmiana B', color: '#10b981' }
];

let allEmployees = [];
let dateAssignments = {};
let dateMeta = {};
let currentDate = new Date().toISOString().split('T')[0];
let scannedEmployees = {};

// Firebase
let firebaseConfig = null;
let firebaseDb = null;
let currentRoomCode = null;
let roomRef = null;
let isRemoteUpdate = false;

const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDlbLvVe2xZ6q8x9pY0aZ1bC2dE3fG4hI5',
    authDomain: 'smarttable-realtime.firebaseapp.com',
    projectId: 'smarttable-realtime',
    databaseURL: 'https://smarttable-realtime-default-rtdb.europe-west1.firebasedatabase.app',
    storageBucket: 'smarttable-realtime.appspot.com',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:abcdef123456'
};

function initApp() {
    loadState();
    ensureDateEntry(currentDate);
    document.getElementById('currentDate').value = currentDate;
    renderBoardZones();
    bindEvents();
    renderEmployees();
    initializeFirebase();
    checkUrlForRoom();
}

function bindEvents() {
    document.getElementById('employeeForm').addEventListener('submit', (event) => {
        event.preventDefault();
        saveEmployee();
    });

    document.getElementById('shiftForm').addEventListener('submit', (event) => {
        event.preventDefault();
        addShift();
    });

    document.getElementById('assignForm').addEventListener('submit', (event) => {
        event.preventDefault();
        assignFromModal();
    });

    document.getElementById('csvImportInput').addEventListener('change', (event) => {
        importEmployeesCsv(event.target.files?.[0]);
        event.target.value = '';
    });

    document.getElementById('jsonImportInput').addEventListener('change', (event) => {
        importBoardJson(event.target.files?.[0]);
        event.target.value = '';
    });

    window.addEventListener('click', (event) => {
        const employeeModal = document.getElementById('employeeModal');
        const shiftsModal = document.getElementById('shiftsModal');
        const assignModal = document.getElementById('assignModal');

        if (event.target === employeeModal) {
            closeEmployeeModal();
        }
        if (event.target === shiftsModal) {
            closeShiftsModal();
        }
        if (event.target === assignModal) {
            closeAssignModal();
        }
    });

    document.getElementById('scanInput').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            scanEmployee(event.target.value.trim());
            event.target.value = '';
        }
    });
}

function loadState() {
    const savedShifts = localStorage.getItem(STORAGE_KEYS.shifts) || localStorage.getItem('shifts');
    const savedEmployees = localStorage.getItem(STORAGE_KEYS.employees) || localStorage.getItem('allEmployees');
    const savedAssignments = localStorage.getItem(STORAGE_KEYS.assignments) || localStorage.getItem('dateAssignments');
    const savedMeta = localStorage.getItem(STORAGE_KEYS.meta);
    const savedScanned = localStorage.getItem(STORAGE_KEYS.scanned);

    if (savedShifts) {
        try {
            const parsed = JSON.parse(savedShifts);
            if (Array.isArray(parsed) && parsed.length) {
                shifts = parsed;
            }
        } catch (_error) {}
    }

    if (savedEmployees) {
        try {
            const parsed = JSON.parse(savedEmployees);
            if (Array.isArray(parsed)) {
                allEmployees = parsed.map(normalizeEmployee);
            }
        } catch (_error) {}
    }

    if (savedAssignments) {
        try {
            const parsed = JSON.parse(savedAssignments);
            dateAssignments = migrateAssignments(parsed);
        } catch (_error) {
            dateAssignments = {};
        }
    }

    if (savedMeta) {
        try {
            const parsed = JSON.parse(savedMeta);
            if (parsed && typeof parsed === 'object') {
                dateMeta = parsed;
            }
        } catch (_error) {}
    }

    if (savedScanned) {
        try {
            const parsed = JSON.parse(savedScanned);
            if (parsed && typeof parsed === 'object') {
                scannedEmployees = parsed;
            }
        } catch (_error) {}
    }
}

function normalizeEmployee(employee) {
    return {
        id: employee.id || `emp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: employee.name || '',
        employeeId: employee.employeeId || '',
        login: employee.login || '',
        shift: employee.shift || (shifts[0] ? shifts[0].id : ''),
        trainings: Array.isArray(employee.trainings) ? employee.trainings : [],
        photo: employee.photo || '',
        manager: employee.manager || ''
    };
}

function migrateAssignments(rawAssignments) {
    const migrated = {};

    if (!rawAssignments || typeof rawAssignments !== 'object') {
        return migrated;
    }

    Object.keys(rawAssignments).forEach((date) => {
        migrated[date] = {};
        const dateData = rawAssignments[date];

        if (!dateData || typeof dateData !== 'object') {
            return;
        }

        Object.keys(dateData).forEach((employeeId) => {
            const entry = dateData[employeeId];

            if (!entry) {
                return;
            }

            if (entry.zone && entry.type) {
                migrated[date][employeeId] = {
                    zone: entry.zone,
                    type: entry.type,
                    note: entry.note || ''
                };
                return;
            }

            const legacyRole = entry.role;
            const legacyNote = entry.note || '';
            const legacyOop = entry.oopDept || '';

            if (MAIN_ROLES.some((role) => role.id === legacyRole)) {
                migrated[date][employeeId] = { zone: legacyRole, type: 'role', note: legacyNote };
            } else if (ABSENCE_ZONES.some((role) => role.id === legacyRole)) {
                migrated[date][employeeId] = { zone: legacyRole, type: 'absence', note: legacyNote };
            } else if (SPECIAL_ZONES.some((role) => role.id === legacyRole)) {
                migrated[date][employeeId] = { zone: legacyRole, type: 'special', note: legacyNote || legacyOop };
            } else if (legacyRole === 'xt' && legacyOop) {
                migrated[date][employeeId] = { zone: `oop-${legacyOop}`, type: 'oop', note: '' };
            }
        });
    });

    return migrated;
}

function saveState() {
    localStorage.setItem(STORAGE_KEYS.shifts, JSON.stringify(shifts));
    localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(allEmployees));
    localStorage.setItem(STORAGE_KEYS.assignments, JSON.stringify(dateAssignments));
    localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify(dateMeta));
    localStorage.setItem(STORAGE_KEYS.scanned, JSON.stringify(scannedEmployees));
    pushRoomUpdate();
}

function ensureDateEntry(date) {
    if (!dateAssignments[date]) {
        dateAssignments[date] = {};
    }

    if (!dateMeta[date]) {
        dateMeta[date] = {
            createdAt: new Date().toISOString(),
            edited: false
        };
        saveState();
    }
}

function getCurrentAssignments() {
    ensureDateEntry(currentDate);
    return dateAssignments[currentDate];
}

function markDateEdited() {
    ensureDateEntry(currentDate);
    dateMeta[currentDate].edited = true;
}

function renderBoardZones() {
    renderZoneList('rolesGrid', MAIN_ROLES, 'role', 'role-section');
    renderZoneList(
        'oopGrid',
        OOP_DEPARTMENTS.map((dept) => ({ id: `oop-${dept}`, name: dept })),
        'oop',
        'role-section oop-section'
    );
    renderZoneList('specialGrid', SPECIAL_ZONES, 'special', 'role-section special-section');
    renderZoneList('absenceGrid', ABSENCE_ZONES, 'absence', 'role-section absence-section');

    const unassignedZone = document.querySelector('[data-zone="unassigned"]');
    if (unassignedZone) {
        attachDropEvents(unassignedZone);
    }
}

function renderZoneList(containerId, zones, type, sectionClass) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    zones.forEach((zone) => {
        const section = document.createElement('div');
        section.className = sectionClass;
        
        // Calculate counter: scanned/total in this zone
        const assignments = getCurrentAssignments();
        let totalInZone = 0;
        let scannedInZone = 0;
        
        Object.entries(assignments).forEach(([empId, assign]) => {
            if (assign?.zone === zone.id) {
                totalInZone++;
                if (isScanned(empId, currentDate)) {
                    scannedInZone++;
                }
            }
        });
        
        let counterDisplay = '';
        if (totalInZone > 0) {
            const counterClass = scannedInZone < totalInZone
                ? 'zone-counter zone-counter-alert'
                : 'zone-counter zone-counter-complete';
            counterDisplay = `<span class="${counterClass}">${scannedInZone}/${totalInZone}</span>`;
        }
        
        section.innerHTML = `
            <div class="role-header">
                <span>${escapeHtml(zone.name)}</span>
                ${counterDisplay}
                <button class="add-to-zone-btn" onclick="openAssignModal('${escapeHtml(zone.id)}','${escapeHtml(type)}','${escapeHtml(zone.name)}')">+</button>
            </div>
            <div class="drop-zone" data-zone="${zone.id}" data-type="${type}"></div>
        `;
        container.appendChild(section);

        const dropZone = section.querySelector('.drop-zone');
        attachDropEvents(dropZone);
    });
}

function attachDropEvents(zone) {
    zone.addEventListener('dragover', (event) => {
        event.preventDefault();
        zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (event) => {
        event.preventDefault();
        zone.classList.remove('drag-over');

        const employeeId = event.dataTransfer.getData('text/plain');
        if (!employeeId) {
            return;
        }

        moveEmployeeToZone(employeeId, zone.dataset.zone, zone.dataset.type || 'unassigned');
    });
}

function moveEmployeeToZone(employeeId, zoneId, zoneType, manualNote) {
    const assignments = getCurrentAssignments();
    const employee = allEmployees.find((item) => item.id === employeeId);

    if (!employee) {
        return;
    }

    if (zoneId === 'unassigned') {
        delete assignments[employeeId];
        markDateEdited();
        saveState();
        renderEmployees();
        return;
    }

    const note = manualNote !== undefined
        ? resolveManualNoteForZone(employee, zoneId, zoneType, manualNote)
        : resolveNoteForZone(employee, zoneId, zoneType);
    if (note === null) {
        return;
    }

    assignments[employeeId] = {
        zone: zoneId,
        type: zoneType,
        note: note || ''
    };

    markDateEdited();
    saveState();
    renderEmployees();
}

function resolveNoteForZone(employee, zoneId, zoneType) {
    if (zoneType === 'oop') {
        const dept = zoneId.replace('oop-', '');
        const hasTraining = employee.trainings.includes(dept);
        if (!hasTraining) {
            const shouldAllowException = confirm(
                `${employee.name} nie ma szkolenia ${dept}. Czy dodać wyjątek i przypisać mimo to?`
            );
            if (!shouldAllowException) {
                return null;
            }
            return `Wyjątek bez szkolenia: ${dept}`;
        }
        return '';
    }

    if (zoneType === 'special') {
        if (zoneId === 'szkolenie') {
            const text = prompt('Wpisz rodzaj szkolenia:');
            return text === null ? null : text.trim();
        }

        if (zoneId === 'spotkanie') {
            const text = prompt('Wpisz temat spotkania:');
            return text === null ? null : text.trim();
        }

        if (zoneId === 'xt') {
            const text = prompt('Wpisz oddział dla XT (np. STOW, VR):');
            return text === null ? null : text.trim();
        }
    }

    return '';
}

function resolveManualNoteForZone(employee, zoneId, zoneType, manualNote) {
    const cleanNote = (manualNote || '').trim();

    if (zoneType === 'oop') {
        const dept = zoneId.replace('oop-', '');
        const hasTraining = employee.trainings.includes(dept);
        if (!hasTraining) {
            return cleanNote || `Wyjątek bez szkolenia: ${dept}`;
        }
        return cleanNote;
    }

    return cleanNote;
}

function openAssignModal(zoneId, zoneType, zoneLabel) {
    const modal = document.getElementById('assignModal');
    const title = document.getElementById('assignModalTitle');
    const select = document.getElementById('assignEmployeeSelect');
    const noteGroup = document.getElementById('assignNoteGroup');
    const noteLabel = document.getElementById('assignNoteLabel');
    const noteInput = document.getElementById('assignNoteInput');

    title.textContent = `Przypisz do: ${zoneLabel}`;
    document.getElementById('assignZoneId').value = zoneId;
    document.getElementById('assignZoneType').value = zoneType;

    select.innerHTML = '';
    allEmployees
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
        .forEach((employee) => {
            const option = document.createElement('option');
            option.value = employee.id;
            option.textContent = `${employee.name} (${employee.employeeId})`;
            select.appendChild(option);
        });

    if (!allEmployees.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Brak pracowników';
        select.appendChild(option);
    }

    let showNote = false;
    let labelText = 'Notatka:';
    if (zoneType === 'special' && zoneId === 'szkolenie') {
        showNote = true;
        labelText = 'Jakie szkolenie:';
    } else if (zoneType === 'special' && zoneId === 'spotkanie') {
        showNote = true;
        labelText = 'Temat spotkania:';
    } else if (zoneType === 'special' && zoneId === 'xt') {
        showNote = true;
        labelText = 'Oddział XT:';
    } else if (zoneType === 'oop') {
        showNote = true;
        labelText = 'Notatka (opcjonalnie):';
    }

    noteGroup.style.display = showNote ? 'block' : 'none';
    noteLabel.textContent = labelText;
    noteInput.value = '';

    modal.style.display = 'block';
}

function closeAssignModal() {
    document.getElementById('assignModal').style.display = 'none';
}

function assignFromModal() {
    const employeeId = document.getElementById('assignEmployeeSelect').value;
    const zoneId = document.getElementById('assignZoneId').value;
    const zoneType = document.getElementById('assignZoneType').value;
    const note = document.getElementById('assignNoteInput').value;

    if (!employeeId || !zoneId) {
        return;
    }

    moveEmployeeToZone(employeeId, zoneId, zoneType, note);
    closeAssignModal();
}

function getInitials(name) {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

function buildCopyableField(label, value, extraClass = '') {
    if (!value) {
        return '';
    }

    return `
        <div class="employee-field ${extraClass}">
            <span class="employee-field-label">${escapeHtml(label)}</span>
            <span class="employee-field-value" title="${escapeHtml(value)}">${escapeHtml(value)}</span>
            <button
                type="button"
                class="copy-field-btn"
                data-copy-value="${encodeURIComponent(value)}"
                data-copy-label="${encodeURIComponent(label)}"
                title="Kopiuj ${escapeHtml(label)}"
            >⧉</button>
        </div>
    `;
}

async function copyTextValue(value, button) {
    if (!value) {
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
    } else {
        const tempInput = document.createElement('textarea');
        tempInput.value = value;
        tempInput.setAttribute('readonly', 'readonly');
        tempInput.style.position = 'absolute';
        tempInput.style.left = '-9999px';
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
    }

    const originalLabel = button.textContent;
    button.textContent = '✓';
    button.classList.add('copied');

    setTimeout(() => {
        button.textContent = originalLabel;
        button.classList.remove('copied');
    }, 1200);
}

function renderEmployees() {
    renderBoardZones();

    document.querySelectorAll('.drop-zone').forEach((zone) => {
        zone.innerHTML = '';
    });

    const assignments = getCurrentAssignments();

    allEmployees.forEach((employee) => {
        const assignment = assignments[employee.id];
        const zoneId = assignment ? assignment.zone : 'unassigned';
        const targetZone = document.querySelector(`[data-zone="${zoneId}"]`) || document.querySelector('[data-zone="unassigned"]');

        if (targetZone) {
            targetZone.appendChild(createEmployeeCard(employee, assignment));
        }
    });

    updateCounters();
    updateDateMeta();
}

function createEmployeeCard(employee, assignment) {
    const card = document.createElement('div');
    card.className = 'employee-card';
    card.draggable = true;
    card.dataset.employeeId = employee.id;

    const shift = shifts.find((item) => item.id === employee.shift);
    const cardColor = shift ? shift.color : '#64748b';
    card.style.backgroundColor = cardColor;
    card.style.borderColor = cardColor;

    const trainingsText = employee.trainings.length ? employee.trainings.join(', ') : 'Brak szkoleń';
    const managerText = employee.manager || 'Brak managera';
    const noteText = assignment?.note ? `<div class="employee-note">${escapeHtml(assignment.note)}</div>` : '';
    const photoContent = employee.photo
        ? `<img src="${escapeHtml(employee.photo)}" alt="${escapeHtml(employee.name)}" onerror="this.remove(); this.parentElement.textContent='${escapeHtml(getInitials(employee.name))}'">`
        : escapeHtml(getInitials(employee.name));

    // Determine badge: checkmark if scanned, X if assigned but not scanned, empty otherwise
    const isAssigned = assignment && assignment.zone && assignment.zone !== 'unassigned';
    const scanned = isScanned(employee.id, currentDate);
    let badgeBg = 'transparent';
    let badgeIcon = '';
    
    if (isAssigned) {
        if (scanned) {
            badgeIcon = '✓';
            badgeBg = '#10b981';
        } else {
            badgeIcon = '✗';
            badgeBg = '#ef4444';
            card.classList.add('scanned-not-found');
        }
    }

    const badgeHtml = badgeIcon ? `<div class="scan-badge" style="background-color: ${badgeBg};">${badgeIcon}</div>` : '';
    const copyAllValue = [
        employee.name,
        `ID: ${employee.employeeId}`,
        `Login: ${employee.login}`,
        `Manager: ${managerText}`,
        `Szkolenia: ${trainingsText}`,
        assignment?.note ? `Notatka: ${assignment.note}` : ''
    ].filter(Boolean).join(' | ');

    card.innerHTML = `
        <button class="edit-btn" onclick="editEmployee('${employee.id}')" title="Edytuj">✎</button>
        <button type="button" class="copy-card-btn" data-copy-value="${encodeURIComponent(copyAllValue)}" title="Kopiuj całą kartę">⧉</button>
        <div class="shift-planet" style="background-color:${escapeHtml(cardColor)}" title="${escapeHtml(shift?.name || 'Brak zmiany')}"></div>
        ${badgeHtml}
        <div class="employee-photo">${photoContent}</div>
        <div class="employee-name">${escapeHtml(employee.name)}</div>
        <div class="employee-fields">
            ${buildCopyableField('ID', employee.employeeId)}
            ${buildCopyableField('Login', employee.login)}
            ${buildCopyableField('Manager', managerText)}
            ${buildCopyableField('Szkolenia', trainingsText, 'employee-field-wide')}
        </div>
        ${noteText}
    `;

    card.querySelectorAll('.copy-field-btn').forEach((button) => {
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();

            const value = decodeURIComponent(button.dataset.copyValue || '');
            await copyTextValue(value, button);
        });
    });

    const copyCardButton = card.querySelector('.copy-card-btn');
    if (copyCardButton) {
        copyCardButton.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();

            const value = decodeURIComponent(copyCardButton.dataset.copyValue || '');
            await copyTextValue(value, copyCardButton);
        });
    }

    card.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', employee.id);
        card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
    });

    return card;
}

function updateCounters() {
    const assignments = getCurrentAssignments();

    let totalCount = 0;
    let oopCount = 0;
    let absentCount = 0;
    let unassignedCount = 0;

    allEmployees.forEach((employee) => {
        const assignment = assignments[employee.id];

        if (!assignment) {
            unassignedCount += 1;
            return;
        }

        if (assignment.type === 'oop') {
            oopCount += 1;
            return;
        }

        if (assignment.type === 'absence') {
            absentCount += 1;
            return;
        }

        totalCount += 1;
    });

    document.getElementById('totalCount').textContent = totalCount;
    document.getElementById('oopCount').textContent = oopCount;
    document.getElementById('absentCount').textContent = absentCount;
    document.getElementById('unassignedCount').textContent = unassignedCount;
}

function updateDateMeta() {
    ensureDateEntry(currentDate);
    const meta = dateMeta[currentDate];
    const createdAt = meta?.createdAt ? new Date(meta.createdAt) : null;

    document.getElementById('boardDateLabel').textContent = formatDateLabel(currentDate);
    document.getElementById('boardCreatedAt').textContent = createdAt ? formatDateLabel(createdAt.toISOString().split('T')[0]) : '-';
}

function formatDateLabel(dateValue) {
    try {
        return new Date(dateValue).toLocaleDateString('pl-PL');
    } catch (_error) {
        return dateValue;
    }
}

function updateShiftSelect() {
    const select = document.getElementById('employeeShift');
    select.innerHTML = '';

    shifts.forEach((shift) => {
        const option = document.createElement('option');
        option.value = shift.id;
        option.textContent = shift.name;
        select.appendChild(option);
    });
}

function openAddEmployeeModal() {
    document.getElementById('modalTitle').textContent = 'Dodaj nowego pracownika';
    document.getElementById('saveEmployeeBtn').textContent = 'Dodaj';
    document.getElementById('deleteEmployeeBtn').style.display = 'none';
    document.getElementById('editEmployeeId').value = '';
    document.getElementById('employeeForm').reset();

    updateShiftSelect();

    if (shifts.length) {
        document.getElementById('employeeShift').value = shifts[0].id;
    }

    document.getElementById('employeeModal').style.display = 'block';
}

function editEmployee(employeeId) {
    const employee = allEmployees.find((item) => item.id === employeeId);
    if (!employee) {
        return;
    }

    document.getElementById('modalTitle').textContent = 'Edytuj pracownika';
    document.getElementById('saveEmployeeBtn').textContent = 'Zapisz';
    document.getElementById('deleteEmployeeBtn').style.display = 'inline-block';
    document.getElementById('editEmployeeId').value = employee.id;
    document.getElementById('employeeName').value = employee.name;
    document.getElementById('employeeId').value = employee.employeeId;
    document.getElementById('employeeLogin').value = employee.login;
    document.getElementById('employeePhoto').value = employee.photo || '';
    document.getElementById('employeeManager').value = employee.manager || '';

    updateShiftSelect();
    document.getElementById('employeeShift').value = employee.shift;

    document.querySelectorAll('.training-checkboxes input[type="checkbox"]').forEach((checkbox) => {
        checkbox.checked = employee.trainings.includes(checkbox.value);
    });

    document.getElementById('employeeModal').style.display = 'block';
}

function closeEmployeeModal() {
    document.getElementById('employeeModal').style.display = 'none';
    document.getElementById('editEmployeeId').value = '';
}

function saveEmployee() {
    const editId = document.getElementById('editEmployeeId').value;
    const name = document.getElementById('employeeName').value.trim();
    const employeeCode = document.getElementById('employeeId').value.trim();
    const login = document.getElementById('employeeLogin').value.trim();
    const shift = document.getElementById('employeeShift').value;
    const photo = document.getElementById('employeePhoto').value.trim();
    const manager = document.getElementById('employeeManager').value.trim();

    if (!name || !employeeCode || !login || !shift) {
        alert('Uzupełnij wymagane pola: Imię, ID, Login, Zmiana.');
        return;
    }

    const trainings = Array.from(
        document.querySelectorAll('.training-checkboxes input[type="checkbox"]:checked')
    ).map((checkbox) => checkbox.value);

    if (editId) {
        const employee = allEmployees.find((item) => item.id === editId);
        if (employee) {
            employee.name = name;
            employee.employeeId = employeeCode;
            employee.login = login;
            employee.shift = shift;
            employee.trainings = trainings;
            employee.photo = photo;
            employee.manager = manager;
        }
    } else {
        allEmployees.push({
            id: `emp-${Date.now()}`,
            name,
            employeeId: employeeCode,
            login,
            shift,
            trainings,
            photo,
            manager
        });
    }

    markDateEdited();
    saveState();
    renderEmployees();
    closeEmployeeModal();
}

function deleteEmployee() {
    const id = document.getElementById('editEmployeeId').value;
    if (!id) {
        return;
    }

    const confirmed = confirm('Czy na pewno chcesz usunąć tego pracownika?');
    if (!confirmed) {
        return;
    }

    allEmployees = allEmployees.filter((employee) => employee.id !== id);
    Object.keys(dateAssignments).forEach((dateKey) => {
        delete dateAssignments[dateKey][id];
    });

    saveState();
    renderEmployees();
    closeEmployeeModal();
}

function openShiftsModal() {
    renderShiftList();
    document.getElementById('shiftsModal').style.display = 'block';
}

function closeShiftsModal() {
    document.getElementById('shiftsModal').style.display = 'none';
    document.getElementById('shiftForm').reset();
    document.getElementById('shiftColor').value = '#8b5cf6';
}

function renderShiftList() {
    const list = document.getElementById('shiftList');
    list.innerHTML = '';

    shifts.forEach((shift) => {
        const item = document.createElement('div');
        item.className = 'shift-item';
        item.innerHTML = `
            <div class="shift-color-box" style="background-color: ${escapeHtml(shift.color)}"></div>
            <div class="shift-name">${escapeHtml(shift.name)}</div>
            <button class="delete-shift-btn" onclick="deleteShift('${shift.id}')">Usuń</button>
        `;
        list.appendChild(item);
    });
}

function addShift() {
    const nameInput = document.getElementById('shiftName');
    const colorInput = document.getElementById('shiftColor');
    const name = nameInput.value.trim();
    const color = colorInput.value;

    if (!name) {
        alert('Podaj nazwę zmiany.');
        return;
    }

    const duplicate = shifts.some((shift) => shift.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
        alert('Taka zmiana już istnieje.');
        return;
    }

    shifts.push({
        id: `shift-${Date.now()}`,
        name,
        color
    });

    saveState();
    renderShiftList();
    updateShiftSelect();
    nameInput.value = '';
    colorInput.value = '#8b5cf6';
    renderEmployees();
}

function deleteShift(shiftId) {
    if (shifts.length <= 1) {
        alert('Musi istnieć przynajmniej jedna zmiana.');
        return;
    }

    const inUse = allEmployees.some((employee) => employee.shift === shiftId);
    if (inUse) {
        alert('Nie można usunąć zmiany, która jest przypisana do pracowników.');
        return;
    }

    shifts = shifts.filter((shift) => shift.id !== shiftId);
    saveState();
    renderShiftList();
    updateShiftSelect();
    renderEmployees();
}

function buildEmployeesCsv() {
    const header = ['name', 'employeeId', 'login', 'shiftName', 'shiftId', 'photo', 'manager', 'trainings'];
    const rows = allEmployees.map((employee) => {
        const shift = shifts.find((item) => item.id === employee.shift);
        return [
            employee.name,
            employee.employeeId,
            employee.login,
            shift?.name || '',
            employee.shift || '',
            employee.photo || '',
            employee.manager || '',
            (employee.trainings || []).join('|')
        ].map(csvEscape);
    });

    return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

function csvEscape(value) {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
}

function exportEmployeesCsv() {
    const csv = buildEmployeesCsv();
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `employees_${currentDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function triggerImportCsv() {
    document.getElementById('csvImportInput').click();
}

async function shareEmployeesData() {
    const csv = buildEmployeesCsv();
    const fileName = `employees_${currentDate}.csv`;

    try {
        if (navigator.share && navigator.canShare) {
            const file = new File([`\uFEFF${csv}`], fileName, { type: 'text/csv' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Employees data',
                    text: 'Eksport danych pracowników',
                    files: [file]
                });
                return;
            }
        }

        await navigator.clipboard.writeText(csv);
        alert('CSV skopiowano do schowka.');
    } catch (_error) {
        alert('Nie udało się udostępnić danych. Użyj przycisku Eksport CSV.');
    }
}

async function importEmployeesCsv(file) {
    if (!file) {
        return;
    }

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
        alert('Plik CSV jest pusty lub niepoprawny.');
        return;
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const index = {
        name: header.indexOf('name'),
        employeeId: header.indexOf('employeeid'),
        login: header.indexOf('login'),
        shiftName: header.indexOf('shiftname'),
        shiftId: header.indexOf('shiftid'),
        photo: header.indexOf('photo'),
        manager: header.indexOf('manager'),
        trainings: header.indexOf('trainings')
    };

    if (index.name === -1 || index.employeeId === -1 || index.login === -1) {
        alert('CSV musi mieć kolumny: name, employeeId, login.');
        return;
    }

    let importedCount = 0;

    for (let i = 1; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row.length) {
            continue;
        }

        const name = (row[index.name] || '').trim();
        const employeeId = (row[index.employeeId] || '').trim();
        const login = (row[index.login] || '').trim();
        const shiftId = index.shiftId >= 0 ? (row[index.shiftId] || '').trim() : '';
        const shiftName = index.shiftName >= 0 ? (row[index.shiftName] || '').trim() : '';
        const photo = index.photo >= 0 ? (row[index.photo] || '').trim() : '';
        const manager = index.manager >= 0 ? (row[index.manager] || '').trim() : '';
        const trainingsRaw = index.trainings >= 0 ? (row[index.trainings] || '').trim() : '';

        if (!name || !employeeId || !login) {
            continue;
        }

        const trainings = trainingsRaw
            ? trainingsRaw.split('|').map((item) => item.trim()).filter(Boolean)
            : [];

        const shiftFromId = shifts.find((shift) => shift.id === shiftId)?.id;
        const shiftFromName = shifts.find((shift) => shift.name.toLowerCase() === shiftName.toLowerCase())?.id;
        const targetShift = shiftFromId || shiftFromName || (shifts[0] ? shifts[0].id : '');

        const existing = allEmployees.find(
            (employee) => employee.employeeId === employeeId || employee.login.toLowerCase() === login.toLowerCase()
        );

        if (existing) {
            existing.name = name;
            existing.login = login;
            existing.shift = targetShift;
            existing.photo = photo;
            existing.manager = manager;
            existing.trainings = trainings;
        } else {
            allEmployees.push({
                id: `emp-${Date.now()}-${i}`,
                name,
                employeeId,
                login,
                shift: targetShift,
                photo,
                manager,
                trainings
            });
        }

        importedCount += 1;
    }

    markDateEdited();
    saveState();
    renderEmployees();
    alert(`Zaimportowano rekordy: ${importedCount}`);
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < normalized.length; i += 1) {
        const char = normalized[i];
        const next = normalized[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                field += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            row.push(field);
            field = '';
            continue;
        }

        if (char === '\n' && !inQuotes) {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            continue;
        }

        field += char;
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows;
}

function loadDateData() {
    const selectedDate = document.getElementById('currentDate').value;
    if (!selectedDate) {
        return;
    }

    clearScanHighlight();
    currentDate = selectedDate;
    ensureDateEntry(currentDate);
    renderEmployees();
}

function changeDate(days) {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + days);
    currentDate = date.toISOString().split('T')[0];
    document.getElementById('currentDate').value = currentDate;
    ensureDateEntry(currentDate);
    renderEmployees();
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function clearScanHighlight() {
    document.getElementById('scanResult').style.display = 'none';
}
function getScannedForDate(date) {
    if (!scannedEmployees[date]) {
        scannedEmployees[date] = [];
    }
    return scannedEmployees[date];
}

function isScanned(employeeId, date) {
    return getScannedForDate(date).includes(employeeId);
}

function markAsScanned(employeeId, date) {
    const scanned = getScannedForDate(date);
    if (!scanned.includes(employeeId)) {
        scanned.push(employeeId);
    }
    saveState();
}

function scanEmployee(scanValue) {
    if (!scanValue) {
        return;
    }

    clearScanHighlight();

    const employee = allEmployees.find(
        (emp) =>
            emp.employeeId.toLowerCase() === scanValue.toLowerCase() ||
            emp.login.toLowerCase() === scanValue.toLowerCase()
    );

    if (!employee) {
        console.log('Pracownik nie znaleziony:', scanValue);
        showScanResult('✗', '#ef4444', 'Pracownik nie znaleziony');
        return;
    }

    const assignments = getCurrentAssignments();
    const assignment = assignments[employee.id];

    const isClockedIn = assignment && assignment.zone !== 'unassigned' && 
                       !['nn', 'urlop', 'l4'].includes(assignment.zone);

    markAsScanned(employee.id, currentDate);

    if (isClockedIn) {
        console.log('Pracownik pришel:', employee.name);
        showScanResult('✓', '#10b981', `${employee.name} - PРИШEL`);
    } else {
        console.log('Pracownik nie pришel:', employee.name);
        showScanResult('✗', '#ef4444', `${employee.name} - NIE PРИШEL`);
    }

    renderEmployees();

    setTimeout(() => {
        clearScanHighlight();
    }, 4000);
}

function showScanResult(icon, color, message) {
    const resultEl = document.getElementById('scanResult');
    const iconEl = document.getElementById('scanResultIcon');
    
    iconEl.textContent = icon;
    iconEl.style.color = color;
    resultEl.title = message;
    resultEl.style.display = 'inline-block';
}

function initializeFirebase() {
    try {
        if (window.firebase && typeof window.firebase.initializeApp === 'function') {
            firebaseDb = window.firebase.database();
            subscribeToRoom();
        }
    } catch (_error) {
        console.log('Firebase not initialized (optional feature)');
    }
}

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function checkUrlForRoom() {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode && firebaseDb) {
        currentRoomCode = roomCode;
        subscribeToRoom();
    }
}

function subscribeToRoom() {
    if (!firebaseDb || !currentRoomCode) {
        return;
    }

    try {
        roomRef = firebaseDb.ref(`rooms/${currentRoomCode}`);
        
        roomRef.on('value', (snapshot) => {
            if (!snapshot.exists()) {
                return;
            }
            
            isRemoteUpdate = true;
            const remoteData = snapshot.val();
            
            if (remoteData.employees) {
                allEmployees = remoteData.employees.map(normalizeEmployee);
            }
            
            if (remoteData.shifts) {
                shifts = remoteData.shifts;
            }
            
            if (remoteData.assignments) {
                dateAssignments = remoteData.assignments || {};
            }
            
            if (remoteData.meta) {
                dateMeta = remoteData.meta || {};
            }
            
            renderEmployees();
            updateShiftSelect();
            isRemoteUpdate = false;
        });
        
        document.getElementById('connStatusSpan').style.display = 'inline';
        document.getElementById('roomId').textContent = currentRoomCode;
        document.getElementById('connStatus').classList.add('connected');
    } catch (_error) {
        console.log('Room subscription failed');
    }
}

function pushRoomUpdate() {
    if (!firebaseDb || !currentRoomCode || isRemoteUpdate) {
        return;
    }

    try {
        roomRef.set({
            employees: allEmployees,
            shifts: shifts,
            assignments: dateAssignments,
            meta: dateMeta,
            lastUpdate: new Date().toISOString()
        });
    } catch (_error) {
        console.log('Failed to sync with room');
    }
}

function openRoomModal() {
    if (!currentRoomCode) {
        currentRoomCode = generateRoomCode();
    }
    
    document.getElementById('roomCodeInput').value = currentRoomCode;
    document.getElementById('joinRoomInput').value = '';
    document.getElementById('roomModal').style.display = 'block';
    
    if (firebaseDb && roomRef) {
        document.getElementById('roomStatusText').textContent = 'Połączony z pokojem';
        document.getElementById('roomInfo').style.display = 'block';
    }
}

function closeRoomModal() {
    document.getElementById('roomModal').style.display = 'none';
}

function copyRoomCode() {
    const code = document.getElementById('roomCodeInput').value;
    if (!code) return;
    
    const url = `${window.location.origin}${window.location.pathname}?room=${code}`;
    navigator.clipboard.writeText(url).then(() => {
        alert('Link pokoju skopiowany do schowka');
    }).catch(() => {
        alert('Nie udało się skopiować. Kod: ' + code);
    });
}

function joinRoom() {
    const code = document.getElementById('joinRoomInput').value.trim().toUpperCase();
    if (!code) {
        alert('Wpisz kod pokoju');
        return;
    }
    
    currentRoomCode = code;
    subscribeToRoom();
    document.getElementById('joinRoomInput').value = '';
    alert(`Dołączono do pokoju: ${code}`);
}

function exportBoardJson() {
    const data = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        currentDate: currentDate,
        employees: allEmployees,
        shifts: shifts,
        assignments: dateAssignments,
        meta: dateMeta
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `board_${currentDate}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function triggerImportBoardJson() {
    document.getElementById('jsonImportInput').click();
}

async function importBoardJson(file) {
    if (!file) {
        return;
    }

    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!data.version || !data.employees || !data.assignments) {
            alert('Plik JSON jest niepoprawny lub uszkodzony.');
            return;
        }
        
        allEmployees = (data.employees || []).map(normalizeEmployee);
        shifts = data.shifts || shifts;
        dateAssignments = data.assignments || {};
        dateMeta = data.meta || {};
        
        markDateEdited();
        saveState();
        pushRoomUpdate();
        renderEmployees();
        updateShiftSelect();
        alert('Importer tabeli powiódł się');
    } catch (_error) {
        alert('Błąd podczas importu: ' + (_error?.message || 'unknown'));
    }
}

window.changeDate = changeDate;
window.loadDateData = loadDateData;
window.openAddEmployeeModal = openAddEmployeeModal;
window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;
window.closeEmployeeModal = closeEmployeeModal;
window.openShiftsModal = openShiftsModal;
window.closeShiftsModal = closeShiftsModal;
window.deleteShift = deleteShift;
window.openAssignModal = openAssignModal;
window.closeAssignModal = closeAssignModal;
window.exportEmployeesCsv = exportEmployeesCsv;
window.triggerImportCsv = triggerImportCsv;
window.shareEmployeesData = shareEmployeesData;
window.openRoomModal = openRoomModal;
window.closeRoomModal = closeRoomModal;
window.copyRoomCode = copyRoomCode;
window.joinRoom = joinRoom;
window.exportBoardJson = exportBoardJson;
window.triggerImportBoardJson = triggerImportBoardJson;
window.scanEmployee = scanEmployee;

window.onload = initApp;