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
      if(!dialog) {
	// Dialog is very new
	alert('Sry no browser support!');
	return;
      }
      const form = this.$refs.form;
      form.onsubmit = (event) => {
	const action = event.submitter.value;
	if(action === 'delete') {
	  point.name = undefined;
	  point.turn = undefined;
	}
	this.open = false;
	event.preventDefault();
	resolve();
      };
      dialog.showModal();
    });
  });
}

const CoursePointDialog = {
  template: '#course-point-dialog-template',
  props: {
    open: Boolean,
    point: Object
  },
  data: () => ({
    open: false,
    point: {},
  }),
  methods: {
    edit,
  }
};

export default CoursePointDialog;
