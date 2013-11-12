var config = require(fs.absolute('gwt'));
phantom.injectJs(config.jqueryPath);
var o = $({});

module.exports = {
    subscribe: function () {
        o.on.apply(o, arguments);
    },
    unsubscribe: function () {
        o.off.apply(o, arguments);
    },
    publish: function () {
        o.trigger.apply(o, arguments);
    }
};