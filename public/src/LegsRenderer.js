define(["dojo/_base/declare",
    "dojo/_base/array",
    "./EcrRenderer",
    "dojox/geo/openlayers/GeometryFeature",
    "dojox/geo/openlayers/LineString",
    "dojox/geo/openlayers/Point",
    "dojox/geo/openlayers/GreatCircle"],
    function (declare, arr, EcrRenderer, GeometryFeature, LineString, Point, GreatCircle) {

        return declare(EcrRenderer, {

            constructor: function (opts, context) {
                this._geodetic = false;
                this._greatCircle = null;
            },

            setGeodetic: function (value) {
                this._geodetic = value;
            },

            getGeodetic: function () {
                return this._geodetic;
            },

            _renderItem: function (o, item) {
                var gf = null;
                if (o.type == "polyline") {
                    var store = this.getContextValue('store');
                    var stops = store.getValues(item, 'stops');
                    var pts = [];
                    var lastCoords = null;
                    arr.forEach(stops, function (it, index, array) {
                        if (store.isItem(it)) {
                            var port = this.getValue(it, "port");
                            if (lastCoords == null) {
                                port.offer = [parseInt(port.offer) + (parseInt(it.capacity[0]) * 2)];
                            } else {
                                port.demand = [parseInt(port.demand) + (parseInt(it.capacity[0]) * 2)];
                            }

                            var coords = this.getCoordinates(port);
                            if (this.getGeodetic()) {
                                if (lastCoords != null) {
                                    var current = {
                                        x: coords[0],
                                        y: coords[1]
                                    };
                                    var geodetic = GreatCircle.toPointArray(lastCoords, current, 5);
                                    pts = pts.concat(geodetic);
                                }
                            } else {
                                var p = new Point({
                                    x: coords[0],
                                    y: coords[1]
                                });
                                pts.push(p);
                            }
                            lastCoords = {
                                x: coords[0],
                                y: coords[1]
                            };
                        }
                    }, this);

                    var g = new LineString(pts);
                    gf = new GeometryFeature(g);
                }
                return gf;
            }
        });
    });
