// LÓGICA PLANNER COMPARTIDO
let currentUser = null;
let allTasks = [];
let selectedDate = new Date().toISOString().split('T')[0];

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    renderWeek();
    loadUsers();
}

// --- NAVEGACIÓN ---
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function switchView(viewId) {
    if (viewId === 'view-agenda' && !currentUser) {
        alert("Por favor, selecciona un usuario primero.");
        return;
    }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function exitApp() {
    if (confirm("¿Deseas cerrar la aplicación?")) {
        window.close();
        // Fallback por si window.close() está bloqueado por el navegador
        document.body.innerHTML = `
            <div style="height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#0f172a; color:white; font-family:sans-serif; text-align:center; padding:2rem;">
                <h1>Gracias por usar Planner</h1>
                <p>Ya puedes cerrar esta pestaña o la aplicación.</p>
                <div style="margin-top:2rem; font-size:0.8rem; color:#94a3b8;">Powered by La Famil.IA</div>
            </div>
        `;
    }
}

function logout() {
    currentUser = null;
    document.getElementById('view-agenda').classList.remove('active');
    document.getElementById('view-selector').classList.add('active');
}

// --- GESTIÓN DE USUARIOS ---
async function loadUsers() {
    const grid = document.getElementById('users-grid');
    grid.innerHTML = '<p>Cargando...</p>';
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        grid.innerHTML = '';
        users.forEach(u => {
            const card = document.createElement('div');
            card.className = 'user-card';
            card.innerHTML = `
                <button class="delete-mini" onclick="event.stopPropagation(); deleteUser('${u.id}')">×</button>
                <h3>${u.name}</h3>
            `;
            card.onclick = () => {
                currentUser = u;
                document.getElementById('view-selector').classList.remove('active');
                document.getElementById('view-agenda').classList.add('active');
                document.getElementById('label-user').innerText = u.name;
                loadTasks();
            };
            grid.appendChild(card);
        });
    } catch (e) { grid.innerHTML = '<p>Error de conexión</p>'; }
}

async function saveUser() {
    const name = document.getElementById('user-name').value;
    if (!name) return;
    await fetch('/api/users', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name})
    });
    document.getElementById('user-name').value = '';
    closeModal('modal-user');
    loadUsers();
}

// --- GESTIÓN DE AGENDA (CALENDARIO) ---
function renderWeek() {
    const strip = document.getElementById('week-strip');
    strip.innerHTML = '';
    const today = new Date();
    
    for (let i = -3; i <= 3; i++) {
        const d = new Date();
        d.setDate(today.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        
        const pill = document.createElement('div');
        pill.className = `day-pill ${iso === selectedDate ? 'active' : ''}`;
        pill.innerHTML = `
            <span>${d.toLocaleDateString('es', {weekday: 'short'})}</span>
            <b>${d.getDate()}</b>
        `;
        pill.onclick = () => {
            selectedDate = iso;
            renderWeek();
            renderTasks();
            document.getElementById('selected-date-label').innerText = i === 0 ? 'Hoy' : d.toLocaleDateString('es', {weekday: 'long', day: 'numeric'});
        };
        strip.appendChild(pill);
    }
}

// --- GESTIÓN DE TAREAS ---
async function loadTasks() {
    try {
        const res = await fetch('/api/tasks');
        allTasks = await res.json();
        renderTasks();
    } catch (e) { console.error(e); }
}

function renderTasks() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';
    
    // Filtrar tareas por fecha o si son permanentes/sin fecha
    const filtered = allTasks.filter(t => {
        if (t.task_type === 'permanent') return true;
        if (!t.due_date) return true; // Mostrar tareas sin fecha siempre
        return t.due_date.startsWith(selectedDate);
    });

    document.getElementById('task-count').innerText = `${filtered.length} tareas`;

    if (filtered.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:gray; padding:2rem;">No hay tareas planeadas</div>';
        return;
    }

    filtered.forEach(t => {
        const item = document.createElement('div');
        item.className = `task-item ${t.status}`;
        item.innerHTML = `
            <div class="task-info">
                <h4>${t.title}</h4>
                <p>${t.description || ''}</p>
            </div>
            <div class="task-actions">
                <input type="checkbox" ${t.status === 'completed' ? 'checked' : ''} 
                       onchange="toggleTask('${t.id}', this.checked)">
                <button class="btn-delete" onclick="deleteTask('${t.id}')">🗑️</button>
            </div>
        `;
        list.appendChild(item);
    });
}

async function deleteUser(id) {
    if (!confirm("¿Borrar este usuario y todas sus referencias?")) return;
    await fetch(`/api/users/${id}`, { method: 'DELETE' });
    loadUsers();
}

async function deleteTask(id) {
    if (!confirm("¿Borrar esta tarea permanentemente?")) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    loadTasks();
}

async function saveTask() {
    const title = document.getElementById('task-title').value;
    const desc = document.getElementById('task-desc').value;
    const type = document.getElementById('task-type').value;
    const date = document.getElementById('task-date').value;

    if (!title) return;

    await fetch('/api/tasks', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            title, description: desc, task_type: type, 
            due_date: type === 'deadline' ? date : null,
            status: 'pending'
        })
    });

    document.getElementById('task-title').value = '';
    document.getElementById('task-desc').value = '';
    closeModal('modal-task');
    loadTasks();
}

async function toggleTask(id, completed) {
    await fetch(`/api/tasks/${id}?completed=${completed}`, { method: 'PATCH' });
    loadTasks();
}

function exportExcel() {
    window.location.href = '/api/export';
}
