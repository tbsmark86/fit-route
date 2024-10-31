
import { getString, setString } from '../localStorage.js';


/**
 * Open dialog and return selected mode
 */
function show() {
  return new Promise((resolve, reject) => {
    this.open = true;
    this.$nextTick(() => {
      try {
	  const dialog = this.$refs.dialog;
	  const form = this.$refs.form;
	  form.onsubmit = (event) => {

	    if (event.submitter && event.submitter.value === 'close') {
		resolve({climbs: 'none', descents: 'none'});
	    } else {
		resolve({climbs: this.climb, descents: this.descent, end: this.end});
	    }
	    this.open = false;
	    event.preventDefault && event.preventDefault();
	  };
	  dialog.onclose = (event) => {
	      if(this.open) {
		  form.onsubmit({submitter: {value: 'close'}});
	      }
	  };
	  dialog.showModal();
       } catch(e) {
	  reject(e);
       }
    });
  });
}

const ClimbDialog = {
  template: '#climb-dialog-template',
  props: {
    open: Boolean,
  },
  data: () => ({
    open: false,
    climb: getString('climbs_climb', 'medium'),
    descent: getString('climbs_descent', 'major'),
    end: getString('climbs_end', 'normal'),
  }),
  methods: {
    show
  },
    watch: {
	climb: (val) => setString('climbs_climb', val),
	descent: (val) => setString('climbs_descent', val),
	end: (val) => setString('climbs_end', val),
    }
};

export default ClimbDialog;
