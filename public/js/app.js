/* global Vue */

import ErrorMessage from './components/error-message.js';
import FitRoute from './components/fit-route.js';

function onError(message) {
  this.error = message;
}

new Vue({
  el: '#main',
  data: {
    error: null
  },
  methods: {
    onError
  },
  components: {
    ErrorMessage,
    FitRoute
  }
});
