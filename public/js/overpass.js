/* jshint esversion: 6 */

/**
 * execute overpass request
 */
function overpass(req) {
    const params = new URLSearchParams();
    params.append('data', req);

    return fetch('https://overpass-api.de/api/interpreter', {
	method: 'POST',
	headers: {
	    'content-type': 'application/x-www-form-urlencoded'
	},
	body: params
    }).then((response) => response.json());
}

function box2poly(box) {
    let str = '(poly:"';
    for(const p of box) {
	str += `${p.lat.toFixed(3)} ${p.lon.toFixed(3)} `;
    }
    str = str.trimRight();
    str += '")';
    return str;
}

function tags2str(tags) {
    let str = '';
    for(const tag of Object.keys(tags)) {
	str += `${tag}=${tags[tag]}`+'\n';
    }
    return str;
}

/**
 * Box is a list of points that forms a polygon
 */
export function findWater(box) {

    const query = `
	[out:json];
	node[amenity=drinking_water]${box2poly(box)};
	out;
    `;
    return overpass(query).then((data) => {
	let res = [];
	for(let ele of data.elements) {
	    if(ele.tags.drinking_water && ele.tags.drinking_water !== 'yes') {
		// should not happen, but maybe ...
		continue;
	    }
	    // not useful
	    delete ele.tags.amenity;
	    delete ele.tags.wheelchair;
	    res.push({
		lat: ele.lat,
		lon: ele.lon,
		name: 'Wasser',
		text: tags2str(ele.tags),
	    });
	}
	return res;
    });
}
