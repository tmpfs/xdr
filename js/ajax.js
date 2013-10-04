;(function() {
  "use strict";

  /**
   *  Polyfill for IE DOM XML parse.
   */
  if(!window.DOMParser && window.ActiveXObject) {
    var Parser = function(){};
    Parser.prototype.baseURI = null;
    Parser.prototype.parseFromString = function(xml, mime) {
      var doc = new ActiveXObject("Microsoft.XMLDOM");
      doc.async	= true;
      doc.validateOnParse = false;
      doc.loadXML(xml);
      return doc;
    };
    window.DOMParser = Parser;
  }

  /**
   *  Creates a DOM element.
   *
   *  @param tag The tag name for the element.
   *  @param attrs Attributes to assign to the element.
   *  @param text Text to append as a child node.
   *
   *  @return The created DOM element.
   */
  var createElement = function(tag, attrs, text) {
    var el = document.createElement(tag);
    for(var z in attrs) {
      el.setAttribute(z, attrs[z]);
    }
    if(text) el.appendChild(document.createTextNode(text));
    return el;
  }

  /**
   *  Detect Internet Explorer version as we cannot feature detect
   *  using ('XDomainRequest' in window) as IE10 retains the
   *  obsolete XDomainRequest object.
   */
  var ie = (function () {
    var version = 0, browser = false, map, jscript;
    map = {
      "5.5": 5.5,
      "5.6": 6,
      "5.7": 7,
      "5.8": 8,
      "9": 9,
      "10": 10
    };
    jscript = new Function("/*@cc_on return @_jscript_version; @*/")();
    if (jscript !== undefined) {
      browser = true;
      version = map[jscript];
    }
    return {version: version, browser: browser};
  }());

  /**
   *  Parse response headers into an object.
   *
   *  @param headers The response headers as a string.
   *
   *  @return An object encapsulating the response headers.
   */
  var parse = function(headers) {
    var output = {}, i, p, k, v;
    headers = headers || "";
    headers = headers.replace('\r', '');
    headers = headers.split('\n');
    for(i = 0;i < headers.length;i++) {
      p = headers[i].indexOf(':');
      k = headers[i].substr(0, p);
      v = headers[i].substr(p + 1);
      if(k && v) {
        k = k.replace(/^\s+/, '').replace(/\s+$/, '');
        v = v.replace(/^\s+/, '').replace(/\s+$/, '');
        output[k.toLowerCase()] = v;
      }
    }
    return output;
  }

  /**
   *  Accepts the URL and query string parameters
   *  and returns a new URL.
   *
   *  @param url The original URL.
   *  @param params The query string parameters.
   *
   *  @return The original or updated URL.
   */
  var qs = function(url, params) {
    if(!params || !(typeof(params) == 'object')) return url;
    var u = new String(url);
    var q = [];
    for(var z in params) {
      q.push(encodeURIComponent(z) + '=' + encodeURIComponent(params[z]));
    }
    var qs = q.join('&');
    u += (u.indexOf('?') == -1) ? '?' : '&';
    u += qs;
    return u;
  }

  /**
   *  Type converters.
   */
  var converters = {
    text: {
      mime: 'text/plain',
      encode: function(data){return data;},
      decode: function(data){return data;}
    },
    json: {
      mime: 'application/json',
      encode: function(data) {
        return JSON.stringify(data);
      },
      decode: function(data) {
        return JSON.parse(data);
      }
    },
    xml: {
      mime: 'application/xml',
      encode: function(data) {
        return data;
      },
      decode: function(data) {
        var parser = new DOMParser();
        return parser.parseFromString(data, converters.xml.mime);
      }
    }
  }

  /**
   *  Converts response text info a response format.
   *
   *  @param text The response text.
   *  @param type The expected response type identifer.
   */
  var convert = function(text, type) {
    var data = text;
    if(converters[type]) {
      var decoder = converters[type].decode;
      data = decoder(data);
    }
    return data;
  }

  /**
   *  Constant indicating whether CORS is used or
   *  whether the XDomainRequest object is used instead.
   */
  var cors = !('XDomainRequest' in window)
    || ie.browser && ie.version == 10;

  /**
   *  Retrieve the object used to make the request.
   */
  var xhr = function() {
    if(!cors) {
      return new XDomainRequest();
    }else if(window.XMLHttpRequest) {
      return new XMLHttpRequest();
    }
    return null;
  }


  /**
   *  JSONP implementation.
   *
   *  @param url The URL to make the request to.
   *  @param options The configuration options.
   */
  var jsonp = function(url, options) {
    this.url = url;
    this.options = options;
  }

  jsonp.counter = -1;

  jsonp.prototype.send = function(message) {
    var self = this;
    var cb = '__jsonp__' + (++jsonp.counter);
    this.url += (this.url.indexOf('?') == -1) ? '?' : '&';
    this.url += encodeURIComponent(this.options.jsonp)
      + '=' + encodeURIComponent(cb);
    var elem = createElement('script',{src: this.url});
    window[cb] = function (packet) {
      if(typeof(self.options.success) == 'function') {
        var res = {status: 200, xhr: self, headers: null};
        res.data = packet;
        self.options.success(res);
      }
    }

    var head = document.getElementsByTagName("head")[0]
      || document.documentElement;
    var done = false;
    var cleanup = function() {
      window[cb] = null;
      delete window[cb];
      if(head && elem.parentNode) {
        head.removeChild(elem);
      }
    }

    // load handlers for all browsers
    elem.onload = elem.onreadystatechange = function() {
      if(!done
         && (!this.readyState
           || this.readyState === "loaded"
           || this.readyState === "complete")) {
        done = true;
        // handle memory leak in IE
        elem.onload = elem.onreadystatechange = null;
        cleanup();
      }
    };
    // perform the request
    head.insertBefore(elem, head.firstChild);
  }

  /**
   *  Declared for compatibility with XMLHttpRequest.
   */
  jsonp.prototype.abort = function(){};

  /**
   *  Performs an ajax request.
   *
   *  @param options.method The HTTP method.
   *  @param options.url The URL to connect to.
   *  @param options.headers An object containing HTTP headers.
   *  @param options.timeout A timeout for the request in milliseconds.
   *  @param options.delay A delay before invoking send() in milliseconds.
   *  @param options.data Data to send with the request.
   *  @param options.credentials Authentication credentials.
   *  @param options.success A callback for 2xx responses.
   *  @param options.error A callback for error responses.
   *  @param options.mime A MIME type passed to overrideMimeType().
   *  @param options.async Whether the request is asynchronous.
   *  @param options.params Query string parameters to append to the URL.
   *  @param options.fields Properties to apply to the XMLHttpRequest.
   *  @param options.parameter Send the data as the named query string
   *  parameter.
   *  @param jsonp The name of the callback query string variable for jsonp
   *  requests, default is 'callback'.
   */
  var ajax = function(options) {
    var req, z, jsp = false, data;
    // no options or no json capability (IE7 etc.)
    if(!(typeof(options) == 'object') || !('JSON' in window) ) {
      return false;
    }

    var type = options.type || 'text';
    // mutate type for jsonp
    if(type == 'jsonp') {
      jsp = true;
      type = 'json';
      options.jsonp = options.jsonp || ajax.defaults.jsonp;
    }

    // unsupported content type
    if(!(type in converters)) {
      return false;
    }

    // unsupported browser version
    if(!jsp && ((ie.browser && ie.version < 8)
      || (!('XMLHttpRequest' in window) && !('XDomainRequest' in window)))) {
      return false;
    }

    // TODO: copy data so as not to affect the source data
    if(options.data) {
      var encoder = converters[type].encode;
      data = encoder(options.data);
    }

    // send the data as a query string parameter
    if(data && (jsp || (typeof(options.parameter) == 'string'))) {
      options.params = options.params || {};
      options.params[options.parameter || ajax.defaults.parameter] = data;
    }

    var url = qs(options.url || "", options.params);
    var method = options.method || ajax.defaults.method;
    var headers = options.headers || {};
    var async = (typeof(options.async) == 'boolean') ? options.async
       : ajax.defaults.async;
    options.credentials = options.credentials || {};

    /**
     *  Generic response handler for invoking the
     *  callback functions.
     */
    var response = function(response) {
      var status = "" + (response.status || 0);
      if(/^2/.test(status)) {
        if(typeof(options.success) == 'function') {
          options.success(response);
        }
      }else{
        if(typeof(options.error) == 'function') {
          options.error(response);
        }
      }
    }

    // execute as jsonp
    if(jsp) {
      req = new jsonp(url, options);
      req.send(data);
      url = req.url;
    // execute as ajax
    }else{
      req = xhr();
      if(!cors) {
        req.open(method, url);
        req.onload = function() {
          var res = {status: this.status || 200, xhr: this, headers: null};
          res.data = convert(this.responseText, type);
          response(res);
        };
        req.onerror = function() {
          var res = {status: this.status || 500, xhr: this, headers: null};
          response(res);
        };
        req.ontimeout = req.onprogress = function(){};
      }else{
        // apply custom fields, eg: withCredentials
        if(options.fields) {
          for(z in options.fields) {
            req[z] = options.fields[z];
          }
        }

        req.open(method, url, async,
          options.credentials.username, options.credentials.password);

        if(options.mime && (typeof(req.overrideMimeType) == 'function')) {
          req.overrideMimeType(options.mime);
        }

        // set default headers
        for(z in ajax.defaults.headers) {
          req.setRequestHeader(z, ajax.defaults.headers[z]);
        }

        // apply custom request headers
        for(z in headers) {
          req.setRequestHeader(z, headers[z]);
        }

        req.onreadystatechange = function() {
          if(this.readyState == 4) {
            var res = {status: this.status, xhr: this};
            res.headers = parse(this.getAllResponseHeaders());
            res.data = convert(this.responseText, type);
            response(res);
          }
        }
      }
      req.timeout = (options.timeout || ajax.defaults.timeout);
      if(!cors) {
        setTimeout(function(){
          req.send(data);
        }, options.delay || ajax.defaults.delay);
      }else{
        req.send(data);
      }
    }

    return {
      xhr: req,
      abort: req.abort,
      cors: cors,
      ie: ie,
      url: url,
      jsonp: jsp
    }
  }

  /**
   *  Expose IE browser information.
   */
  ajax.ie = ie;

  /**
   *  Expose the jsonp implementation.
   */
  ajax.jsonp = jsonp;

  /**
   *  Expose type converters.
   */
  ajax.converters = converters;

  /**
   *  Default options.
   */
  ajax.defaults = {
    method: 'GET',
    timeout: 10000,
    delay: 0,
    async: true,
    parameter: 'packet',
    jsonp: 'callback',
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  }

  if(typeof(module) === "object" && typeof(module.exports) === "object") {
    module.exports = ajax;
  }else if(typeof(define) == 'function' && define.amd) {
    define("ajax", [], function () { return ajax; });
  }else if(window) {
    window.ajax = ajax;
  }
})();
