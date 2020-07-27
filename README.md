FIT Route Converter
===================

This is a serverless solution to the problem of converting a GPX file for
an event into a FIT file that can be used directly by a Garmin Edge cycle
computer.

Development
-----------

Start a local server:

```console
$ yarn install
$ yarn start
```

The application will be served up on <http://localhost:8080/>.

BrowserStack
------------

To use _BrowserStack Live_ with _Local Testing_ launch the _BrowserStack Local_
application as follows:
```console
$ BrowserStackLocal --key "$BROWSERSTACK_KEY" --folder "$PWD/public" 
```

Notes
-----

This has been written using ES6 modules, and does not need a build step to
transpile for execution.  All 3rd party libraries are loaded from their CDNs.

Currently only Chrome, Firefox and Safari are supported.  It would be possible
to transpile & polyfill to support other browsers.

Documentation of the FIT file format is contained in the FIT SDK
([download](https://www.thisisant.com/resources/fit/)), and this implementation
does the bare minimum required.

The mapping uses [CARTO](https://github.com/CartoDB/basemap-styles) raster tiles,
which are free for up to 75,000 mapviews per month for non-commercial use.

Third Party Libraries
---------------------

* [Vue.js](https://vuejs.org/)
* [Bootstrap](https://getbootstrap.com/)
* [Leaflet](https://leafletjs.com/)
* [Font Awesome](https://fontawesome.com/)
