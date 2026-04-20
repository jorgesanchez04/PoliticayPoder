// --- VARIABLES GLOBALES ---
let categoriaActual = null;

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    await gestionarVisibilidadAdmin();
    await cargarMenuCategorias();

    const esIndex = window.location.pathname.includes("index.html") || window.location.pathname === "/";
    
    if (esIndex) {
        const urlParams = new URLSearchParams(window.location.search);
        const catUrl = urlParams.get('cat');
        
        // 1. Determinar categoría
        if (catUrl && catUrl !== "null") {
            categoriaActual = catUrl;
        } else {
            categoriaActual = null;
        }

        await cargarNoticiasInicio();

        // 2. Restaurar scroll
        const scrollGuardado = sessionStorage.getItem('posicionScroll');
        const catPrevia = sessionStorage.getItem('categoriaPrevia');

        // Restauramos si hay scroll guardado Y (no hay categoría nueva o es la misma que antes)
        if (scrollGuardado) {
            const esMismaCat = (catUrl === catPrevia) || (!catUrl && catPrevia === "null");
            
            if (esMismaCat) {
                window.scrollTo({
                    top: parseInt(scrollGuardado),
                    behavior: 'instant'
                });
            }
            // Limpiamos memoria para que no salte en navegaciones frescas
            sessionStorage.removeItem('posicionScroll');
            sessionStorage.removeItem('categoriaPrevia');
        }
    }
});

// --- NAVEGACIÓN INTELIGENTE ---
function filtrarPorCategoria(cat) {
    const esIndex = window.location.pathname.includes("index.html") || window.location.pathname === "/";
    
    if (esIndex) {
        categoriaActual = cat;
        cargarNoticiasInicio();
        // Si estamos en el index y hacemos clic en un filtro, subimos al inicio
        window.scrollTo(0, 0); 
    } else {
        // Si estamos en post.html, volvemos al index con la categoría elegida
        // Usamos 'null' como texto para que el index lo reconozca
        const categoriaDestino = (cat === null) ? 'null' : cat;
        window.location.href = `index.html?cat=${categoriaDestino}`;
    }
}

// ALIAS: Para que el botón que dice "volverAInicio" en el HTML no de error
function volverAInicio(cat) {
    const esIndex = window.location.pathname.includes("index.html") || window.location.pathname === "/";
    
    if (esIndex) {
        categoriaActual = cat;
        cargarNoticiasInicio();
        window.scrollTo(0, 0);
    } else {
        // Si cat es null, intentamos recuperar la categoría de la memoria
        let catDestino = cat;
        if (cat === null) {
            const guardada = sessionStorage.getItem('categoriaPrevia');
            catDestino = (guardada && guardada !== "null") ? guardada : 'null';
        }
        window.location.href = `index.html?cat=${catDestino}`;
    }
}

function abrirNoticia(id) {
    // Guardamos la posición del scroll
    sessionStorage.setItem('posicionScroll', window.scrollY);
    // NUEVO: Guardamos la categoría que el usuario estaba viendo
    sessionStorage.setItem('categoriaPrevia', categoriaActual); 
    
    window.location.href = `post.html?id=${id}`;
}

// --- CARGAR NOTICIAS (PÁGINA PRINCIPAL) ---
async function cargarNoticiasInicio() {
    const contenedor = document.getElementById("contenedorNoticias");
    if (!contenedor) return;

    let query = supabase.from("posts").select("*").order("fecha", { ascending: false });

    if (categoriaActual !== null) {
        query = query.eq("categoria", categoriaActual);
    }

    const { data: posts, error } = await query;
    if (error) { console.error(error); return; }

    if (posts.length === 0) {
        contenedor.innerHTML = `<p style="text-align:center; grid-column: 1/-1;">No hay noticias disponibles en esta categoría.</p>`;
        return;
    }

    contenedor.innerHTML = "";
    posts.forEach(post => {
        const imgRegex = /<img[^>]+src="([^">]+)"/g;
        const match = imgRegex.exec(post.contenido);
        const urlPrimeraImagen = match ? match[1] : null;

        const card = document.createElement("div");
        card.className = urlPrimeraImagen ? "noticia-card" : "noticia-card no-image";
        
        // Usamos la función que guarda el scroll
        card.onclick = () => abrirNoticia(post.id);

        card.innerHTML = `
            ${urlPrimeraImagen ? `<div class="card-image"><img src="${urlPrimeraImagen}"></div>` : ''}
            <div class="card-content">
                <h3 class="card-title">${post.titulo}</h3>
            </div>
        `;
        contenedor.appendChild(card);
    });
}

// --- MENÚ DE CATEGORÍAS DINÁMICO ---
async function cargarMenuCategorias() {
    const { data: posts, error } = await supabase.from("posts").select("categoria");
    if (error) return;

    const categoriasUnicas = [...new Set(posts
        .map(p => p.categoria)
        .filter(c => c !== null && c !== undefined && c.trim() !== "")
    )];
    
    const nav = document.querySelector("nav");
    if (!nav) return;

    const adminBtn = document.getElementById('crearPostBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    let htmlMenu = `<a href="#" onclick="filtrarPorCategoria(null)">Inicio</a>`;

    const visibles = categoriasUnicas.slice(0, 4);
    const extras = categoriasUnicas.slice(4);

    visibles.forEach(cat => {
        htmlMenu += `<a href="#" onclick="filtrarPorCategoria('${cat}')">${cat}</a>`;
    });

    if (extras.length > 0) {
        htmlMenu += `
            <div class="dropdown">
                <a href="#" class="dropbtn">Más ▾</a>
                <div class="dropdown-content">
                    ${extras.map(cat => `<a href="#" onclick="filtrarPorCategoria('${cat}')">${cat}</a>`).join('')}
                </div>
            </div>`;
    }

    nav.innerHTML = htmlMenu;
    if(adminBtn) nav.appendChild(adminBtn);
    if(logoutBtn) nav.appendChild(logoutBtn);
}

// --- GESTIÓN DE USUARIO ---
async function gestionarVisibilidadAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    const adminBtn = document.getElementById('crearPostBtn');
    const loginLink = document.getElementById('loginLink');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user) {
        if (adminBtn) adminBtn.style.display = 'inline-flex';
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        if (loginLink) loginLink.style.display = 'none';
    } else {
        if (adminBtn) adminBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (loginLink) loginLink.style.display = 'inline';
    }
}

async function login() {
    const email = document.getElementById("usuario").value;
    const password = document.getElementById("password").value;
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { alert("Error: " + error.message); } 
        else { cerrarLogin(); location.reload(); }
    } catch (err) { console.error(err); }
}

async function logout() {
    await supabase.auth.signOut();
    window.location.href = "index.html";
}

// --- MODALES Y NAVEGACIÓN ---
function abrirModal() { document.getElementById("loginModal").style.display = "block"; }
function cerrarLogin() { document.getElementById("loginModal").style.display = "none"; }
function irAdmin() { window.location.href = "admin.html"; }