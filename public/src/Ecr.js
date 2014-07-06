define(["dojo/_base/kernel",
    "dojo/_base/declare",
    "dojo/_base/html",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/dom",
    "dojox/geo/openlayers/Map",
    "dojox/geo/openlayers/GfxLayer",
    "dojo/data/ItemFileReadStore",
    "./PortRenderer",
    "./LegsRenderer"],
    function (dojo, declare, html, arr, lang, dom, Map, GfxLayer, ItemFileReadStore, PortRenderer, LegsRenderer) {

        return declare(null, {
            constructor: function () {

                var map = new Map("map", {
                    //baseLayerType: dojox.geo.openlayers.BaseLayerType.OSM
                    //baseLayerType: dojox.geo.openlayers.BaseLayerType.WMS
                    baseLayerType: dojox.geo.openlayers.BaseLayerType.GOOGLE
                    //baseLayerType: dojox.geo.openlayers.BaseLayerType.VIRTUAL_EARTH
                    //baseLayerType: dojox.geo.openlayers.BaseLayerType.BING
                    //baseLayerType: dojox.geo.openlayers.BaseLayerType.YAHOO
                    //baseLayerType: dojox.geo.openlayers.BaseLayerType.ARCGIS
                });

                map.fitTo([-160, 70, 160, -70]);

                this._map = map;

                layer = new GfxLayer("legs");
                this._legLayer = layer;
                map.addLayer(layer);

                layer = new GfxLayer("ports");
                this._portLayer = layer;
                map.addLayer(layer);

                this._routes = {};
                this._ports = {};

                this.loadData("data/hackathon.json");
            },

            fitTo: function (where) {
                this._map.fitTo(where);
            },

            clearLayer: function (layer) {
                var fa = layer.getFeatures();
                layer.removeFeature(fa);
            },

            clearEcr: function (event) {
                var layer = this._portLayer;
                this.clearLayer(layer);
                layer = this._legLayer;
                this.clearLayer(layer);
                this.fillPortChooser(null);
                this._ports = {};
                this._routes = {};

                this.loadData("data/hackathon.json");
            },

            setDataSet: function (name) {
                var o = dom.byId(name);
                var ds = o.value;

                var layer = this._portLayer;
                this.clearLayer(layer);

                layer = this._legLayer;
                this.clearLayer(layer);

                this.loadData(ds);

            },

            log: function (o) {
                console.log(o);
            },

            loadError: function () {
                this.log(arguments[0]);
            },

            _portStyle: [
                {
                    type: "circle",
                    depth: "{radius}",
                    radius: function (ctx) {
                        return 1 * Math.max(1, Math.log(this.offer[0]));
                    },
                    stroke: {
                        color: "#bb0000",
                        width: 2
                    }
                },
                {
                    type: "circle",
                    depth: "{radius}",
                    radius: function (ctx) {
                        return 1 * Math.max(1, Math.log(this.demand[0]));
                    },
                    stroke: {
                        color: "#4c9a06",
                        width: 2
                    }
                }
            ],

            gotPorts: function (items, request) {
                //this.log("got ports " + items.length);
                var store = request.store;
                var ctx = {
                    store: store
                };
                var renderer = new PortRenderer(this._portStyle, ctx);
                var layer = this._portLayer;

                var ports = this._ports;

                var ecr = this;

                arr.forEach(items, function (item, index, array) {
                    if (!(item.name in ports)) {
                        ports[item.name] = item;
                    }
                    ecr.renderPort(renderer, item);
                });

                this.fillPortChooser(items);

                //this.portChange('portChooser');

                layer.redraw();
            },

            renderPort: function(renderer, item)
            {
                if (!(item.name in this._ports)) {
                    this._ports[item.name] = item;
                }

                var f = renderer.render(item);
                if (f != null)
                {
                    this.removeFeatureFromLayer(this._portLayer, item.name, f[0]);
                    this.removeFeatureFromLayer(this._portLayer, item.name, f[1]);
                    this._portLayer.addFeature(f);
                }
            },

            _legsStyle: {
                type: "polyline",
                stroke: {
                    color: [255, 165, 0],
                    width: function (ctx) {
                        if (this._route_name in ctx.routes) {
                            ++ctx.routes[this._route_name];
                        }
                        else {
                            ctx.routes[this._route_name] = 1;
                        }

                        return Math.max(1, Math.log(ctx.routes[this._route_name]));
                    }
                }
            },

            gotLegs: function (items, request) {
                //this.log("got legs " + items.length);
                var ctx = {
                    routes: this._routes,
                    store: request.store
                };
                var portRenderer = new PortRenderer(this._portStyle, ctx);
                var legsRenderer = new LegsRenderer(this._legsStyle, ctx);
                legsRenderer.setGeodetic(true);

                var layer = this._legLayer;

                var ecr = this;

                arr.forEach(items, function (item, index, array) {
                    if ( item.stops[0].port[0] != null && item.stops[1].port[0] != null)
                    {
                        item._route_name = item.stops[0].port[0].name + "-" + item.stops[1].port[0].name;

                        var f = legsRenderer.render(item);
                        if (f != null) {
                            ecr.renderPort(portRenderer, ecr._ports[item.stops[0].port[0].name]);
                            ecr.renderPort(portRenderer, ecr._ports[item.stops[1].port[0].name]);

                            ecr.removeFeatureFromLayer(layer, item._route_name, f);
                            layer.addFeature(f);
                        }
                    }
                });

                this._portLayer.redraw();

                if (layer.olLayer.getVisibility())
                {
                    layer.redraw();
                }
            },

            removeFeatureFromLayer: function (layer, featureId, feature)
            {
                feature.__id = featureId;

                var features = layer.getFeatures();
                if (features != null) {
                    for (var pos in features) {
                        if (features[pos].__id == featureId) {
                            layer.removeFeatureAt(pos);
                            break;
                        }
                    }
                }
            },


            loadData: function (dataSet) {
                var store;

                if (typeof dataSet == "object") {
                    store = new ItemFileReadStore({
                        data: dataSet
                    });

                    var ports = this._ports;

                    store.__getItemByIdentity = store._getItemByIdentity;
                    store._getItemByIdentity = function (/* Object */ identity) {
                        var item = this.__getItemByIdentity(identity);
                        if (item == null) {
                            if (identity in ports) {
                                item = ports[identity];
                            } else {
                                //console.log("not found: " + identity);
                            }
                        }

                        return item;
                    }

                    if (typeof dataSet.aggregated != 'undefined' && dataSet.aggregated)
                    {
                        this._legLayer.clear();

                        for(var key in this._ports)
                        {
                            this._ports[key].demand = 0;
                            this._ports[key].offer = 0;
                        }
                    }
                }
                else {
                    store = new ItemFileReadStore({
                        url: dataSet,
                        urlPreventCache: true
                    });
                }

                store.fetch({
                    query: {
                        type: "legs"
                    },
                    onComplete: lang.hitch(this, this.gotLegs),
                    onError: lang.hitch(this, this.loadError),
                    queryOptions: {
                        deep: true
                    }
                });

                store.fetch({
                    query: {
                        type: "port"
                    },
                    onComplete: lang.hitch(this, this.gotPorts),
                    onError: lang.hitch(this, this.loadError)
                });
            },

            regionChange: function (event) {
                this.fitTo(event.currentTarget.value);
            },

            portChange: function (name) {
                var o = dom.byId(name);
                this.fitTo(o.value);
            },

            fillPortChooser: function (items) {
                var ps = dom.byId("portChooser");
                var opts = ps.options;
                var ws = '{"position": [0, 0], "extent": 70}';
                if (items != null && items.length > 0) {
                    opts.length = items.length + 1;
                    opts[0] = new Option("World", ws);
                    var s = '{"position": [%lo, %la], "extent": 0.2}';
                    for (var i = 0; i < items.length; i++) {
                        var item = items[i];
                        var lon = parseFloat(item.longitude);
                        var lat = parseFloat(item.latitude);
                        var os = s.replace("%lo", lon).replace("%la", lat);
                        opts[i + 1] = new Option(item.name, os);
                    }
                }
            },

            toggleLayerVisibility: function (name) {
                var cb = dom.byId(name);
                var a = this._map.getLayer('name', name);
                arr.forEach(a, function (item, index, array) {
                    item.olLayer.setVisibility(cb.checked);
                    if (cb.checked)
                    {
                        item.redraw();
                    }
                });
            }
        });
    });
