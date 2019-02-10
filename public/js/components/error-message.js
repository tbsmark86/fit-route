function cssClass() {
  return ['alert', `alert-${this.category}`]
}

const ErrorMessage = {
  template: '#error-message-template',
  props: {
    message: String
  },
  computed: {
    cssClass
  }
};

export default ErrorMessage;
