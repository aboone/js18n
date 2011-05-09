// js18n - javascript internationalization framework

if (typeof js18n == 'undefined') {
	js18n = {};
}

js18n.ResourceBundle = function(bundleName, locale, config) {
	var bundleData;
	var reverseBundleData;
	var loaded = false;

	if (typeof config != 'object') {
		config = {};
	}

	var utils = {
		getData : function(bundle) {
			var fqName = bundle.getBundleName();
			if (config.lazyLoad === true && typeof bundleData == 'undefined') {
				var data = this.loadBundle(fqName);
				bundleData = data ? data : {};
			}

			return bundleData;
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
		getBundleUrl : function(bundleName) {
			var base = config.bundlePath || './bundles';
			return base + '/' + bundleName + '.js';
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
						return bundle.data;
					}
				} catch (e) {}
			}
		},
		loadBundleAsync : function(bundleName, bundleObj) {
			js18n.LoaderQueue.add(bundleName, bundleObj);
			var scr = document.createElement('script');
			scr.setAttribute('src', this.getBundleUrl(bundleName));
			document.body.appendChild(scr);
		}
	}

	var b = {
		setLocale : function(loc) {
			locale = loc;
		},
		getBundleName : function() {
			return bundleName + '_' + locale;
		},
		isLoaded : function() {
			return loaded;
		},
		setBundleData : function(data) {
			bundleData = data;
			loaded = true;
		},
		getString : function(key, defaultToKey) {
			var val = utils.getData(this)[key];
			if (val) {
				return val;
			} else if (defaultToKey !== false) {
				return key;
			}
		},
		findKey : function(str) {
			if (reverseBundleData == undefined) {
				var data = utils.getData(this);
				reverseBundleData = {};
				for (var k in data) {
					if (data.hasOwnProperty(k)) {
						reverseBundleData[data[k]] = k;
					}
				}
			}

			return reverseBundleData[str];
		}
	};

	if (!config.lazyLoad) {
		utils.loadBundleAsync(b.getBundleName(), b);
	}

	return b;
};

js18n.Utils = function() {
	var findTextNodes = function(root) {
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
				textNodes = textNodes.concat( findTextNodes(nodes[i]) );
			}
		}
		return textNodes;
	};

	return {
		localize : function(root, bundle) {
			var nodes = findTextNodes(root);
			for (var i=0; i<nodes.length; i++) {
				var val = nodes[i].nodeValue;
				nodes[i].nodeValue = bundle.getString(val);
			}
		},
		convertTerm : function(term, sourceBundle, destBundle) {
			if (sourceBundle.getBundleName() == destBundle.getBundleName()) {
				return term;
			}

			var key = sourceBundle.findKey(term.replace(/(^\s+|\s+$)/g, ''));
			if (key) {
				return destBundle.getString(key, false);
			}
		},
		convert : function(root, sourceBundle, destBundle) {
			if (sourceBundle.getBundleName() == destBundle.getBundleName()) {
				return;
			}

			var nodes = findTextNodes(root);
			for (var i=0; i<nodes.length; i++) {
				var val = nodes[i].nodeValue;
				var trVal = this.convertTerm(val, sourceBundle, destBundle);
				if (trVal) {
					nodes[i].nodeValue = trVal;
				}
			}
		}
	};
}();

js18n.bundleLoaded = function(bundle) {
	js18n.LoaderQueue.process(bundle);
};

js18n.LoaderQueue = function() {
	return {
		queue : {},
		listeners : [],
		add : function(name, bundle) {
			if (!this.queue[name]) {
				this.queue[name] = [];
			}
			this.queue[name].push(bundle);
		},
		addListener : function(fn) {
			this.listeners.push(fn);
		},
		process : function(bundle) {
			var fqn = bundle.name + '_' + bundle.locale;
			var q = this.queue[fqn];
			if (q) {
				for (var i=0; i<q.length; i++) {
					q[i].setBundleData(bundle.data);
				}
			}
			delete this.queue[fqn];
			
			for (var j=0; j<this.listeners.length; j++) {
				this.listeners[j](fqn, bundle);
			}
		}
	};
}();
