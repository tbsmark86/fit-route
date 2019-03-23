try {
  eval('const i = {}; const j = {...i};');
}
catch (e) {
  const script = document.createElement("script")
  // script.defer = 'defer';
  script.src = 'js/unsupported.js';
  document.body.appendChild(script);
}
