// Display the content of <noscript> tags
const elements = document.getElementsByTagName('noscript');
for (let i = elements.length - 1; i >= 0; i--) {
  const element = elements[i];
  const content = document.createElement('div');
  content.innerHTML = element.textContent;
  while (content.hasChildNodes()) {
    element.parentNode.insertBefore(content.firstChild, element);
  }
  element.parentNode.removeChild(element);
}

// Remove all <script> tags
const scripts = document.getElementsByTagName('script');
for (let i = scripts.length - 1; i >= 0; i--) {
  const script = scripts[i];
  if (script.src) {
    const comment = document.createComment(script.outerHTML);
    script.parentNode.replaceChild(comment, script);
  }
}
