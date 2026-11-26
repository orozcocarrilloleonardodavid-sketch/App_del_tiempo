const formulario = document.getElementById('formulario');
const inputCiudad = document.getElementById('ciudad');
const mensaje = document.getElementById('mensaje');
const actual = document.getElementById('actual');
const pronostico = document.getElementById('pronostico');
const escena = document.getElementById('escena');
let relojActivo = null;

function describir(codigo) {
  if (codigo === 0) return 'Despejado';
  if (codigo <= 3) return 'Parcialmente nublado';
  if (codigo === 45 || codigo === 48) return 'Niebla';
  if (codigo <= 57) return 'Llovizna';
  if (codigo <= 67) return 'Lluvia';
  if (codigo <= 77) return 'Nieve';
  if (codigo <= 82) return 'Chubascos';
  if (codigo <= 86) return 'Chubascos de nieve';
  return 'Tormenta';
}

function ocultarResultados() {
  actual.hidden = true;
  pronostico.hidden = true;
  escena.hidden = true;
  clearInterval(relojActivo);
}

function minutos(texto) {
  // Formato recibido: "2026-11-24T16:34"
  return parseInt(texto.slice(11, 13), 10) * 60 + parseInt(texto.slice(14, 16), 10);
}

function momentoDelDia(clima) {
  const ahora = minutos(clima.current.time);
  const amanece = minutos(clima.daily.sunrise[0]);
  const anochece = minutos(clima.daily.sunset[0]);
  if (ahora < amanece - 30 || ahora > anochece + 30) return 'noche';
  if (ahora < amanece + 60) return 'amanecer';
  if (ahora > anochece - 60) return 'atardecer';
  return 'dia';
}

function actualizarEscena(clima) {
  const codigo = clima.current.weather_code;
  let clases = 'escena ' + momentoDelDia(clima);
  if (codigo >= 3) clases += ' nublado';
  if (codigo >= 51) clases += ' lluvia';
  escena.className = clases;
  escena.hidden = false;
}


function iniciarReloj(zona) {
  const elemento = document.getElementById('hora');
  clearInterval(relojActivo);

  function pintar() {
    const ahora = new Date();
    const hora = ahora.toLocaleTimeString('es', {
      timeZone: zona, hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const fecha = ahora.toLocaleDateString('es', {
      timeZone: zona, weekday: 'long', day: 'numeric', month: 'long'
    });
    elemento.textContent = '';
    const negrita = document.createElement('strong');
    negrita.textContent = hora;
    elemento.append(negrita, fecha);
  }

  pintar();
  relojActivo = setInterval(pintar, 1000);
}

async function buscar(ciudad) {
  mensaje.textContent = 'Buscando...';
  ocultarResultados();

  try {
    // 1. Convertir el nombre de la ciudad en coordenadas
    const urlGeo = 'https://geocoding-api.open-meteo.com/v1/search?name='
      + encodeURIComponent(ciudad) + '&count=1&language=es';
    const respGeo = await fetch(urlGeo);
    if (!respGeo.ok) throw new Error('Error de red');
    const datosGeo = await respGeo.json();

    if (!datosGeo.results || datosGeo.results.length === 0) {
      mensaje.textContent = 'No encontramos esa ciudad. Revisa cómo está escrita.';
      return;
    }

    const { latitude, longitude, name, country } = datosGeo.results[0];

    // 2. Pedir el clima con esas coordenadas
    const urlClima = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + latitude + '&longitude=' + longitude
      + '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset'
      + '&timezone=auto';
    const respClima = await fetch(urlClima);
    if (!respClima.ok) throw new Error('Error de red');
    const clima = await respClima.json();

    mostrar(name, country, clima);
    mensaje.textContent = '';

    try { localStorage.setItem('ultimaCiudad', ciudad); } catch (e) {}
  } catch (error) {
    mensaje.textContent = 'No se pudo conectar. Revisa tu internet e inténtalo de nuevo.';
  }
}

function mostrar(nombre, pais, clima) {
  actualizarEscena(clima);
  iniciarReloj(clima.timezone);

  const c = clima.current;
  const etiqueta = (pais && pais !== nombre) ? nombre + ', ' + pais : nombre;
  document.getElementById('lugar').textContent = etiqueta;
  document.getElementById('temp').textContent = Math.round(c.temperature_2m) + '°C';
  document.getElementById('desc').textContent = describir(c.weather_code);
  document.getElementById('detalle').textContent =
    'Humedad ' + c.relative_humidity_2m + '% · Viento ' + Math.round(c.wind_speed_10m) + ' km/h';

  const lista = document.getElementById('dias');
  lista.textContent = '';

  // Índices 1 a 5: los próximos cinco días (el 0 es hoy)
  for (let i = 1; i <= 5; i++) {
    const fecha = new Date(clima.daily.time[i] + 'T12:00:00');
    const dia = fecha.toLocaleDateString('es', { weekday: 'long', day: 'numeric' });
    const max = Math.round(clima.daily.temperature_2m_max[i]);
    const min = Math.round(clima.daily.temperature_2m_min[i]);

    const li = document.createElement('li');
    const izquierda = document.createElement('span');
    izquierda.textContent = dia + ': ' + describir(clima.daily.weather_code[i]);
    const derecha = document.createElement('strong');
    derecha.textContent = min + '° / ' + max + '°';
    li.append(izquierda, derecha);
    lista.appendChild(li);
  }

  actual.hidden = false;
  pronostico.hidden = false;
}

formulario.addEventListener('submit', function (evento) {
  evento.preventDefault();
  const ciudad = inputCiudad.value.trim();
  if (ciudad) buscar(ciudad);
});

// Al abrir la página, carga la última ciudad buscada
try {
  const guardada = localStorage.getItem('ultimaCiudad');
  if (guardada) {
    inputCiudad.value = guardada;
    buscar(guardada);
  }
} catch (e) {}