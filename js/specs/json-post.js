define(function(require) {
  var packet = {greeting: 'hello', number: 10};
  var error = function(response, xhr) {
    console.log('error: ' + response.status);
  }
  var assert = function(response) {
    expect(response).to.have.property('status')
      .to.be.a('number').that.equals(200);

    // response data
    expect(response).to.have.property('data')
      .to.be.an('object');
    var data = response.data;
    expect(data).to.have.property('greeting')
      .to.be.a('string').that.equals('hello');
    expect(data).to.have.property('number')
      .to.be.a('number').that.equals(10);

    // response headers

    //expect(response).to.have.property('headers')
      //.to.be.an('object');
    //expect(response.headers).to.have.property('date')
      //.to.be.a('string');
    //expect(response.headers).to.have.property('content-length')
      //.to.be.a('string');
    //expect(response.headers).to.have.property('content-type')
      //.to.be.a('string').that.equals('application/json; charset=utf-8');
  }
  var ajax = require('ajax');
  describe('Ajax transport', function() {
    it('a POST to /echo should receive json response on same domain', function(done) {
      var success = function(response, xhr) {
        assert(response, xhr);
        done();
      }
      var opts = {
        url: '/echo',
        method: 'post',
        type: 'json',
        headers: {
          'content-type': 'application/json'
        },
        data: packet,
        success: success,
        error: error
      };
      ajax(opts);
    });

    it('a POST to http://xdomain.socialal.ly/echo should receive json response on cross domain', function(done) {
      var success = function(response, xhr) {
        assert(response, xhr);
        done();
      }
      var opts = {
        url: 'http://xdomain.socialal.ly/echo',
        method: 'post',
        type: 'json',
        headers: {
          'content-type': 'application/json'
        },
        data: packet,
        success: success,
        error: error
      };
      ajax(opts);
    });
  });
});