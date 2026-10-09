'use strict';

const renderIcon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

function renderPreviewRow(symbol, title, detail, tag = '') {
  return `<div class="preview-item">${renderIcon(symbol)}<div><strong>${title}</strong><small>${detail}</small></div>${tag ? `<span class="preview-tag">${tag}</span>` : ''}</div>`;
}

function renderModulePreview(title, symbol, content, footer) {
  return `<div class="preview-window"><div class="preview-heading"><strong>${title}</strong>${renderIcon(symbol)}</div>${content}<div class="preview-footer">${renderIcon('check')} ${footer}</div></div><p class="preview-label">VISTA ILUSTRATIVA · DATOS DE EJEMPLO</p>`;
}

const appModules = {
  cultivos: {
    label: 'REGISTRO Y MONITOREO',
    title: 'Lleva el registro<br>de tus cultivos.',
    description: 'Registra tus cultivos, sus variedades y la superficie sembrada. Guarda monitoreos, observaciones y fechas para consultar el desarrollo de cada parcela.',
    list: ['Registro de cultivos, variedades y superficie', 'Monitoreos, síntomas y observaciones', 'Historial y seguimiento por etapas'],
    preview: () => renderModulePreview('Mis cultivos', 'leaf',
      renderPreviewRow('leaf', 'Maíz', 'Parcela norte · En desarrollo', 'Activo') +
      renderPreviewRow('leaf', 'Frijol', 'Parcela sur · Seguimiento', 'Activo') +
      renderPreviewRow('leaf', 'Tomate', 'Huerto · Monitoreo registrado', 'Activo'),
      'Consulta el historial de cada cultivo.')
  },
  porcino: {
    label: 'PESO Y ALIMENTACIÓN',
    title: 'Consulta el crecimiento<br>de tus cerdos.',
    description: 'Organiza tus lotes, registra tus animales y lleva el control de su peso y consumo. Consulta planes de alimentación según sus pesajes y tu objetivo de producción.',
    list: ['Registro de animales, lotes y observaciones', 'Historial de peso y consumo de alimento', 'Planes de alimentación con apoyo de IA'],
    preview: () => renderModulePreview('Seguimiento porcino', 'pig',
      renderPreviewRow('pig', 'Lote de crecimiento', 'Historial de pesajes', 'Activo') +
      '<div class="preview-chart"><svg viewBox="0 0 270 90" aria-label="Ejemplo ilustrativo de evolución del peso"><path d="M0 80H270M0 45H270M0 10H270" stroke="var(--line)" fill="none"/><path d="M8 76 52 64 94 60 137 43 180 37 220 20 262 8V85H8Z" fill="var(--leaf)" opacity=".15"/><path d="M8 76 52 64 94 60 137 43 180 37 220 20 262 8" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></div>' +
      renderPreviewRow('chart', 'Plan de alimentación', 'Peso actual y objetivo de producción'),
      'Compara los pesajes de tus animales.')
  },
  diagnostico: {
    label: 'DIAGNÓSTICO POR FOTO',
    title: 'Revisa posibles problemas<br>en tus plantas.',
    description: 'Toma o selecciona una fotografía de tu planta desde su monitoreo. El análisis con inteligencia artificial te ayuda a identificar posibles problemas y orientar el seguimiento.',
    list: ['Fotos desde la cámara o la galería', 'Análisis visual de posibles plagas y enfermedades', 'Resultados y avisos dentro de la app'],
    preview: () => renderModulePreview('Escanear planta', 'scan',
      '<div class="scan-preview">' + renderIcon('leaf') + '<span class="scan-corner"></span></div>' +
      renderPreviewRow('scan', 'Diagnóstico de la planta', 'Fotografía, análisis y seguimiento'),
      'Guarda el resultado en el monitoreo del cultivo.')
  },
  gestion: {
    label: 'ADMINISTRACIÓN DE LA FINCA',
    title: 'Organiza los recursos<br>y el trabajo de tu finca.',
    description: 'Organiza las áreas productivas, registra ingresos y egresos y comparte el trabajo con tu equipo según sus permisos. Consulta reportes y avisos de la finca.',
    list: ['Áreas productivas y transacciones', 'Reportes para consultar tu actividad', 'Miembros, solicitudes y avisos'],
    preview: () => renderModulePreview('Gestión de finca', 'home',
      renderPreviewRow('chart', 'Ingresos y egresos', 'Movimientos de tu producción') +
      renderPreviewRow('user', 'Tu equipo', 'Miembros y solicitudes') +
      renderPreviewRow('bell', 'Actividad y avisos', 'Notificaciones de la finca'),
      'Consulta los movimientos y la participación de tu equipo.')
  }
};

const moduleTabs = [...document.querySelectorAll('[data-module]')];

function showModule(key, moveFocus = false) {
  const moduleContent = appModules[key];
  if (!moduleContent) return;

  moduleTabs.forEach(tab => {
    const selected = tab.dataset.module === key;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && moveFocus) tab.focus();
  });

  document.querySelector('#module-panel').setAttribute('aria-labelledby', `tab-${key}`);
  document.querySelector('#module-label').textContent = moduleContent.label;
  document.querySelector('#module-title').innerHTML = moduleContent.title;
  document.querySelector('#module-description').textContent = moduleContent.description;
  document.querySelector('#module-list').innerHTML = moduleContent.list.map(item => `<li>${item}</li>`).join('');
  document.querySelector('#module-preview').innerHTML = moduleContent.preview();
}

moduleTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => showModule(tab.dataset.module));
  tab.addEventListener('keydown', event => {
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % moduleTabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + moduleTabs.length) % moduleTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = moduleTabs.length - 1;
    if (nextIndex !== undefined) {
      event.preventDefault();
      showModule(moduleTabs[nextIndex].dataset.module, true);
    }
  });
});
showModule('cultivos');

const milpiExamples = {
  cultivos: ['¿En qué me puedes ayudar con mis cultivos?', 'Te acompaño con orientación sobre cultivos y manejo de tu finca. Cuéntame qué estás cultivando y qué has observado para comenzar.'],
  porcino: ['¿Cómo empiezo a seguir el crecimiento de mis cerdos?', 'En la app puedes registrar tus animales y sus pesajes. Si buscas un plan de alimentación, comienza con un pesaje reciente y define tu objetivo de peso.'],
  finca: ['¿Puedo organizar mi finca con MilpaGrow?', 'Sí. Puedes registrar áreas productivas, ingresos y egresos, y gestionar la participación de tu equipo. Yo también puedo orientarte con los cálculos de la finca.']
};

const exampleButtons = [...document.querySelectorAll('[data-question]')];
exampleButtons.forEach(button => {
  button.addEventListener('click', () => {
    exampleButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle('selected', active);
      item.setAttribute('aria-pressed', String(active));
    });
    const [question, answer] = milpiExamples[button.dataset.question];
    document.querySelector('#chat-question').textContent = question;
    document.querySelector('#chat-answer').textContent = answer;
  });
});

const themeToggle = document.querySelector('.theme-toggle');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.innerHTML = renderIcon(theme === 'dark' ? 'sun' : 'moon');
  themeToggle.setAttribute('aria-label', `Activar modo ${theme === 'dark' ? 'claro' : 'oscuro'}`);
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0E2818' : '#F5F3EE';
}

try {
  const savedTheme = localStorage.getItem('milpagrow-theme');
  if (savedTheme === 'dark' || savedTheme === 'light') applyTheme(savedTheme);
} catch { /* El navegador puede bloquear el almacenamiento local. */ }

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  try {
    localStorage.setItem('milpagrow-theme', theme);
  } catch { /* El tema se mantiene durante esta visita. */ }
});

const navigationToggle = document.querySelector('.menu-toggle');
const mobileNavigation = document.querySelector('#mobile-nav');

function closeNavigation() {
  mobileNavigation.hidden = true;
  navigationToggle.setAttribute('aria-expanded', 'false');
  navigationToggle.setAttribute('aria-label', 'Abrir menú');
}

navigationToggle.addEventListener('click', () => {
  const open = mobileNavigation.hidden;
  mobileNavigation.hidden = !open;
  navigationToggle.setAttribute('aria-expanded', String(open));
  navigationToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
});

mobileNavigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNavigation));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileNavigation.hidden) {
    closeNavigation();
    navigationToggle.focus();
  }
});
document.addEventListener('click', event => {
  if (!mobileNavigation.hidden && !event.target.closest('.site-header')) closeNavigation();
});
matchMedia('(min-width: 801px)').addEventListener('change', event => {
  if (event.matches) closeNavigation();
});

if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('is-pending');
        entry.target.classList.add('is-visible');
        sectionObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(element => {
    element.classList.add('is-pending');
    sectionObserver.observe(element);
  });
}

document.querySelector('.download-link').addEventListener('click', () => {
  if (document.querySelector('.download-link').getAttribute('aria-disabled') === 'true') return;
  document.querySelector('#download-status').textContent = 'Tu navegador abrirá el enlace de descarga. Cuando termine, abre MilpaGrow.apk desde las descargas de tu Android.';
});
