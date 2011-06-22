// js18n - javascript internationalization framework
//
// Configuration Options
// 	bundlePath 	=> URL prefix for loading bundles (default: './bundles')
// 	loadingMode	=> 'ajax' or 'jsonp' (default: 'jsonp')

js18n = function(config) {

	var cache = {};
	var listeners = [];

	var addListener = function(requiredBundles, fn, scope) {
		var l = {
			bundles: requiredBundles || [],
			fn: fn,
			scope: scope || window
		};
		listeners.push(l);
		return l;
	}

	var ResourceBundle = function(bundleObj) {
		var name = bundleObj.name;
		var locale = bundleObj.locale;
		var bundleData = bundleObj.data;
		var reverseBundleData;

		return {
			getBundleName : function() {
				return privateUtils.getBundleName(name, locale);
			},
			getString : function(key, defaultToKey) {
				var val = bundleData[key];
				if (val) {
					return val;
				} else if (defaultToKey !== false) {
					return key;
				}
			},
			findKey : function(str) {
				if (reverseBundleData == undefined) {
					reverseBundleData = {};
					for (var k in bundleData) {
						if (bundleData.hasOwnProperty(k)) {
							reverseBundleData[bundleData[k]] = k;
						}
					}
				}

				return reverseBundleData[str];
			}
		};
	};

	var MessageSource = function(bundleNames, locale) {
		if (typeof bundleNames == 'string') {
			return new MessageSource([bundleNames], locale);
		}

		var bundles = [];
		for (var i=0; i<bundleNames.length; i++) {
			bundles.push(privateUtils.getBundleName(bundleNames[i], locale));
		}

		return {
			getBundles : function() {
				return bundles;
			},
			getString : function(key, defaultToKey) {
				for (var i=0; i<bundles.length; i++) {
					var b = js18n.getBundle(bundles[i]);
					var val = b.getString(key, false);
					if (val) {
						return val;
					}
				}
				if (defaultToKey !== false) {
					return key;
				}
			},
			findKey : function(str) {
				for (var i=0; i<bundles.length; i++) {
					var b = js18n.getBundle(bundles[i]);
					var val = b.findKey(str);
					if (val) {
						return val;
					}
				}
			}
		};
	}
	MS = MessageSource;

	var privateUtils = {
		findTextNodes : function(root) {
			var textNodes = [];
			if (!root) {
				return textNodes;
			} else if (root.nodeType == 3) {
				if (root.nodeValue && root.nodeValue.replace(/(^\s+|\s+$)/g, '')) {
					textNodes.push(root);
				}
			} else if (root && root.childNodes) {
				var nodes = root.childNodes;
				for (var i=0; i<nodes.length; i++) {
					textNodes = textNodes.concat( this.findTextNodes(nodes[i]) );
				}
			}
			return textNodes;
		},
		getBundleName : function(bundle, locale) {
			return bundle + '_' + locale;
		},
		getBundleUrl : function(bundleName) {
			var base = config.bundlePath || './bundles';
			return base + '/' + bundleName + '.js';
		},
		getXHR : function() {
			var xhr;

			try {
				xhr = new window.XMLHttpRequest();
			} catch(e) {}
			try {
				xhr = window.ActiveXObject( "Microsoft.XMLHTTP" );
			} catch (e) {}

			return xhr;
		},
		loadBundle : function(bundleName) {
			var xhr = this.getXHR();

			if (xhr) {
				xhr.open('GET', this.getBundleUrl(bundleName), false);
				xhr.send(null);

				if (xhr.status != 200) {
					return;
				}

				try {
					eval(xhr.responseText);
					if (typeof bundle == 'object' && bundle.data) {
						js18n.bundleLoaded(bundle);
					}
				} catch (e) {}
			}
		},
		loadBundleAsync : function(bundleName) {
			var scr = document.createElement('script');
			scr.setAttribute('src', this.getBundleUrl(bundleName));
			document.body.appendChild(scr);
		},
		parseBundleName : function(bundleName) {
			var parts = bundleName.split('_');
			return {name: parts[0], locale: parts[1]};
		},
		testListener : function(l) {
			var satisfied = true;
			for (var i=0; i<l.bundles.length; i++) {
				satisfied = satisfied && js18n.getBundle(l.bundles[i]);
			}

			if (satisfied) {
				l.fn.apply(l.scope);
			}

			return satisfied;
		}
	}

	return {
		bundleLoaded : function(bundle) {
			var rb = new ResourceBundle(bundle);
			cache[rb.getBundleName()] = rb;

			for (var j=0; j<listeners.length; j++) {
				if (privateUtils.testListener(listeners[j])) {
					listeners.splice(j--, 1);
				}
			}
		},
		convert : function(root, bundleNames, srcLocale, destLocale, callback, scope) {
			if (typeof bundleNames == 'string') {
				return this.convert(root, [bundleNames], srcLocale, destLocale, callback, scope);
			}

			var src = new MessageSource(bundleNames, srcLocale);
			var dest = new MessageSource(bundleNames, destLocale);

			var cb = function() {
				if (typeof callback == 'function') {
					callback.apply(scope || window, [src, dest]);
				}
			}

			if (srcLocale == destLocale) {
				cb();
			} else {

				var bundles = Array.concat(src.getBundles(), dest.getBundles());
				
				var that = this;
				this.load(bundles, function() {
					var nodes = privateUtils.findTextNodes(root);
					for (var i=0; i<nodes.length; i++) {
						var val = nodes[i].nodeValue;

						var trVal = that.convertTerm(val, src, dest);
						if (trVal) {
							nodes[i].nodeValue = trVal;
						}
					}

					cb();
				});
			}
		},
		convertTerm : function(term, srcMessageSource, destMessageSource) {
			var key = srcMessageSource.findKey(term.replace(/(^\s+|\s+$)/g, ''));
			if (key) {
				return destMessageSource.getString(key, false);
			}
		},
		getBundle : function(name, locale) {
			if (locale) {
				name = privateUtils.getBundleName(name, locale);
			}
			return cache[name];
		},
		load : function(bundles, fn, scope) {
			if (typeof bundles == 'string') {
				this.load([bundles], fn, scope);
			}

			if (fn) {
				var listener = addListener(bundles, fn, scope);
			}
			
			for (var i=0; i<bundles.length; i++) {
				var name = bundles[i];
				if (!cache.hasOwnProperty(name)) {
					cache[name] = null;
					if (config.loadingStyle == 'ajax') {
						privateUtils.load(name);
					} else {
						privateUtils.loadBundleAsync(name);
					}
				}
			}

			privateUtils.testListener(listener);
		},
		localize : function(root, bundle, callback, scope) {
			var nodes = privateUtils.findTextNodes(root);
			for (var i=0; i<nodes.length; i++) {
				var val = nodes[i].nodeValue;
				nodes[i].nodeValue = bundle.getString(val);
			}

			if (typeof callback == 'function') {
				callback.apply(scope || window);
			}
		}
	};
}(typeof js18nConfig == 'object' ? js18nConfig : {});
