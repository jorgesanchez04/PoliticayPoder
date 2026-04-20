// Configuración inicial para compatibilidad del módulo ImageResize
window.Quill = Quill;
Quill.register('modules/imageResize', ImageResize.default);

let quill;

window.onload = async () => {
    await proteger();
    
    // Inicializar Quill
    quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: [
                    [{ 'header': [1, 2, false] }],
                    ['bold', 'italic', 'underline'],
                    ['image', 'link'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }]
                ],
                handlers: {
                    image: imageHandler
                }
            },
            // Activamos el módulo de redimensionado
            imageResize: {
                displaySize: true
            }
        }
    });

    cargarPosts();
};

// FUNCIÓN PARA SUBIR IMÁGENES AL BUCKET
async function imageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        if (file) {
            const fileName = `${Date.now()}-${file.name}`;
            
            const { data, error } = await supabase.storage
                .from('imagenes')
                .upload(fileName, file);

            if (error) {
                alert("Error al subir imagen: " + error.message);
                return;
            }

            const { data: publicUrlData } = supabase.storage
                .from('imagenes')
                .getPublicUrl(fileName);

            const url = publicUrlData.publicUrl;

            const range = quill.getSelection();
            quill.insertEmbed(range ? range.index : 0, 'image', url);
        }
    };
}

// GUARDAR O ACTUALIZAR POST
async function guardarPost() {
    const titulo = document.getElementById("tituloInput").value;
    const contenido = quill.root.innerHTML;
    const idExistente = document.getElementById("postIdActual").value;
    const autorInput = document.getElementById("autorInput").value.trim();
    const fechaSeleccionada = document.getElementById("fechaInput").value;
    
    // 1. Obtenemos la categoría y limpiamos espacios
    const categoriaInput = document.getElementById("categoriaInput").value.trim();

    const autor = autorInput === "" ? "Anónimo" : autorInput;
    
    // 2. (CAMBIO AQUÍ) Si está vacío, enviamos null en lugar de "General"
    const categoria = categoriaInput === "" ? null : categoriaInput;

    const fechaFinal = fechaSeleccionada ? new Date(fechaSeleccionada + "T12:00:00") : new Date();

    if (!titulo || contenido === "<p><br></p>") {
        alert("Por favor, llena el título y el contenido");
        return;
    }

    const datosPost = { 
        titulo, 
        contenido, 
        autor, 
        categoria, 
        fecha: fechaFinal 
    };


    if (idExistente) {
        const res = await supabase.from("posts").update(datosPost).eq("id", idExistente);
        error = res.error;
    } else {
        const res = await supabase.from("posts").insert([datosPost]);
        error = res.error;
    }

    if (error) {
        alert("Error al guardar: " + error.message);
    } else {
        alert(idExistente ? "Noticia actualizada" : "Noticia publicada");
        limpiarFormulario();
        cargarPosts();
    }
}

// PREPARAR EDICIÓN
async function prepararEdicion(id) {
    const { data, error } = await supabase.from("posts").select("*").eq("id", id).single();
    if (error) return;

    document.getElementById("tituloInput").value = data.titulo;
    document.getElementById("autorInput").value = data.autor;
    document.getElementById("postIdActual").value = data.id;
    document.getElementById("categoriaInput").value = data.categoria || "";
    quill.root.innerHTML = data.contenido;

    // Cargar la fecha en el formato YYYY-MM-DD que requiere el input date
    if (data.fecha) {
        const fechaISO = new Date(data.fecha).toISOString().split('T')[0];
        document.getElementById("fechaInput").value = fechaISO;
    }

    document.getElementById("formTitle").innerText = "Editando noticia";
    window.scrollTo(0, 0);
}

function limpiarFormulario() {
    document.getElementById("tituloInput").value = "";
    document.getElementById("autorInput").value = "";
    document.getElementById("fechaInput").value = "";
    document.getElementById("postIdActual").value = "";
    document.getElementById("categoriaInput").value = "";
    quill.root.innerHTML = "";
    document.getElementById("formTitle").innerText = "Crear nueva noticia";
}

// ELIMINAR
async function eliminarPost(id) {
    if (!confirm("¿Estás seguro de eliminar esta noticia?")) return;

    try {
        // 1. Obtener los datos de la noticia antes de borrarla para buscar imágenes
        const { data: post, error: fetchError } = await supabase
            .from("posts")
            .select("contenido")
            .eq("id", id)
            .single();

        if (fetchError) throw fetchError;

        // 2. Extraer URLs de imágenes del contenido usando una Expresión Regular
        // Buscamos lo que esté dentro de src=".../imagenes/nombredelarchivo"
        const imgRegex = /storage\/v1\/object\/public\/imagenes\/([^"'\s>]+)/g;
        let match;
        const archivosABorrar = [];

        while ((match = imgRegex.exec(post.contenido)) !== null) {
            archivosABorrar.push(match[1]); // Guardamos solo el nombre del archivo
        }

        // 3. Borrar archivos del Storage si existen
        if (archivosABorrar.length > 0) {
            const { error: storageError } = await supabase.storage
                .from('imagenes')
                .remove(archivosABorrar);
            
            if (storageError) console.warn("Aviso: Algunos archivos no se borraron del bucket:", storageError);
        }

        // 4. Finalmente, borrar la noticia de la tabla
        const { error: deleteError } = await supabase
            .from("posts")
            .delete()
            .eq("id", id);

        if (deleteError) throw deleteError;

        alert("Noticia e imágenes eliminadas correctamente.");
        cargarPosts();

    } catch (err) {
        console.error("Error en el proceso de borrado:", err);
        alert("Hubo un error al intentar borrar todo el contenido.");
    }
}

// CARGAR LISTA
async function cargarPosts() {
    const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("id", { ascending: false });

    const contenedor = document.getElementById("listaPosts");
    contenedor.innerHTML = "";

    if (data) {
        data.forEach(post => {
            const div = document.createElement("div");
            div.style = "background: #1a1a1a; padding: 15px; margin-bottom: 10px; border-radius: 5px; border-left: 4px solid #c40000;";
            div.innerHTML = `
                <h3 style="margin-top:0;">${post.titulo}</h3>
                <p style="color:#888; font-size:0.8em;">Categoría: ${post.categoria || 'General'}</p>
                <button onclick="prepararEdicion('${post.id}')" ...>✏️ Editar</button>
                <button onclick="eliminarPost('${post.id}')" ...>🗑️ Eliminar</button>
            `;
            contenedor.appendChild(div);
        });
    }
}

// SEGURIDAD Y NAVEGACIÓN
async function proteger() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) window.location.href = "index.html";
}

async function logout() {
    await supabase.auth.signOut();
    window.location.href = "index.html";
}

function volver() {
    window.location.href = "index.html";
}