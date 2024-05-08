/**
 * Open dialog and change point in-place.
 * returns a promise that resolve once the dialog is closed in any way
 */
function edit(point) {
  return new Promise((resolve) => {
    this.open = true;
    this.point = point;
    this.$nextTick(() => {
      const dialog = this.$refs.dialog;
      if (!dialog) {
        alert('Sry no browser support!');
        return;
      }
      const form = this.$refs.form;
      const clearKeyboard = listenKeyboard(form, point);
      form.onsubmit = (event) => {
        if (event.submitter && event.submitter.value === 'delete') {
          point.name = undefined;
          point.turn = undefined;
        }
        this.open = false;
        clearKeyboard();
        event.preventDefault();
        resolve();
      };
      dialog.onclose = (event) => {
	// Handle any close of dialog; most important 'esc'
	// Note: we're always saving - cancel is not supported
	if(this.open) {
	  form.onsubmit(event);
	}
      };
      dialog.showModal();
    });
  });
}

function listenKeyboard(form, point) {
  const handler = (event) => {
    if (event.target instanceof HTMLInputElement) {
      return;
    }
    // based on a-w-s-d gaming style navigation
    switch (event.key) {
      case 'a':
        point.turn = 'left';
        break;
      case 'q':
        point.turn = 'slight_left';
        break;
      case 'z':
      case 'y':
        point.turn = 'sharp_left';
        break;
      case 'd':
        point.turn = 'right';
        break;
      case 'e':
        point.turn = 'slight_right';
        break;
      case 'c':
        point.turn = 'sharp_right';
        break;
      // not sure if keep_left is useful
      case 's':
        point.turn = 'u_turn';
        break;
      case 'w':
        point.turn = 'straight';
        break;
      case 'x':
        point.turn = 'generic';
        break;
      case 'Delete':
      case 'r':
        // remove
        event.submitter = { value: 'delete' };
        break;
      case 'Enter':
      case 'Escape':
        // just close
        break;
      default:
        return;
    }
    console.log(`intercepted key ${event.key}`);
    event.preventDefault();
    form.onsubmit(event);
  };
  window.addEventListener('keydown', handler);
  return window.removeEventListener.bind(window, 'keydown', handler);
}

const CoursePointDialog = {
  template: '#course-point-dialog-template',
  props: {
    open: Boolean,
    point: Object
  },
  data: () => ({
    open: false,
    point: {}
  }),
  methods: {
    edit
  }
};

export default CoursePointDialog;
