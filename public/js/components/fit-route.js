import { parseGpx } from '../gpx.js';
import FileUpload from './file-upload.js';
import RouteMap from './route-map.js';

function distance() {
  const points = this.route.points;
  const km = points[points.length - 1].distance / 1000;
  return km < 1000 ? km.toPrecision(3) : Math.round(km);
}

async function onFileUpload(gpxFile) {
  try {
    this.gpxFile = gpxFile;
    this.route = await parseGpx(gpxFile);
  }
  catch (error) {
    console.error(error);
    this.$emit('error', `Unable to process "${gpxFile.name}"`);
  }
}

const FitRoute = {
  template: '#fit-route-template',
  data: () => ({
    gpxFile: null,
    route: null
  }),
  computed: {
    distance
  },
  methods: {
    onFileUpload
  },
  components: {
    FileUpload,
    RouteMap
  }
};

export default FitRoute;
