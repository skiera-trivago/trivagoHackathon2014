var _ecr = null;

require(["dojo/ready", "src/Ecr"],
    function (ready, Ecr) {
        ready(function () {
            _ecr = new Ecr();
        });
    });

var socketio = io.connect("127.0.0.1:8888");
socketio.on("send_items", function(data) {
    var dataSet = JSON.parse(data.message);

    if (_ecr != null)
    {
        _ecr.loadData(dataSet);
    }
});