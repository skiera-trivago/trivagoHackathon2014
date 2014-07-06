var http = require('http'),
    fs = require('fs'),
    finalhandler = require('finalhandler'),
    serveStatic = require('serve-static'),
    mysql = require('mysql'),
    redis = require('redis');

// Serve up public/ftp folder
var serve = serveStatic('public', {'index': ['index.html']});

var app = http.createServer(function (request, response) {
    var done = finalhandler(request, response);
    serve(request, response, done);
}).listen(8888);

var connection = mysql.createConnection({
    host: 'x.x.x.x',
    user: 'user',
    password: 'password',
    database: 'hackathon'
});

var client = redis.createClient(false, "x.x.x.x");
client.on("error", function (err) {
    console.log("Error " + err);
});

var runCronJob = false;

var io = require('socket.io').listen(app);
io.sockets.on('connection', function (socket) {
    socket.on('send_items', function (data) {
        console.log("recieved send_items");
        io.sockets.emit("send_items", { message: data["message"] });
    });

    socket.on('load_testdata_germany', function (data) {
        console.log("recieved load_testdata_germany");
        testDataFunction(
            //'SELECT *, 1 as capacity FROM hackathon_event_dataset WHERE country_search != country_user AND country_user = "Germany"',
            'SELECT *, 1 AS day_search, amount AS capacity FROM hackathon_aggr_country_user WHERE country_search != country_user AND country_user = "Germany" ORDER BY year_search ASC, month_search ASC',
            20000,
            100,
            function (testDataJson) {
                io.sockets.emit("send_items", { message: testDataJson});
            }, 500, 0);
    });

    socket.on('load_testdata_montly', function (data) {
        console.log("recieved load_testdata_montly");
        testDataFunction(
            'SELECT *, 1 AS day_search, amount AS capacity FROM hackathon_aggr_country_user WHERE country_search != country_user ORDER BY year_search ASC, month_search ASC',
            20000,
            100,
            function (testDataJson) {
                io.sockets.emit("send_items", { message: testDataJson});
            }, 50, 0);
    });

    socket.on('load_testdata_yearly', function (data) {
        console.log("recieved load_testdata_yearly");
        testDataFunction(
            'SELECT *, 1 AS day_search, amount AS capacity FROM hackathon_aggr_country_user WHERE country_search != country_user GROUP BY year_search, country_search, country_user ORDER BY year_search ASC',
            30000,
            100,
            function (testDataJson) {
                io.sockets.emit("send_items", { message: testDataJson});
            }, 50, 0);
    });

    socket.on('toggle_redis_job', function (data) {
        console.log("recieved toggle_redis_job");
        if (!runCronJob) {
            runCronJob = true;
            cronjobFunction();
        }
        else {
            runCronJob = false;
        }

    });
});


var cronjobFunction = function () {
    if (runCronJob)
    {
        console.log("cronjob load data");
        client.hgetall("origin-destination:country", function (err, replies) {
            var rows = [];
            for (var key in replies) {

                var countries = key.split(':');

                if ("Germany" == countries[0])
                {
                    var row = {
                        country_user: countries[0],
                        year_search: "2014",
                        month_search: "1",
                        day_search: "1",
                        country_search: countries[1],
                        capacity: replies[key]
                    };

                    rows.push(row);
                }
            }

            console.log("rows " + rows.length);

            var items = testCreateItemList(rows);
            items.aggregated = 1;

            io.sockets.emit("send_items", { message: JSON.stringify(items)});
            if (runCronJob)
            {
                setTimeout(cronjobFunction, 500);
            }
        });
    }
}

var testDataFunction = function (sql, maxRows, limit, callback, timeout, offset) {
    console.log("testDataFunction " + offset);
    connection.query(sql + ' LIMIT ' + limit + ' OFFSET ' + offset, function (err, rows, fields) {
        if (err) throw err;

        var items = testCreateItemList(rows);

        callback(JSON.stringify(items));

        this.end();

        if (rows.length == limit && offset < maxRows) {
            setTimeout(function () {
                testDataFunction(sql, maxRows, limit, callback, timeout, offset + limit);
            }, timeout);
        } else {
            console.log("done");
        }
    });
}

var testCreateItemList = function (rows) {
    var items = {
        identifier: "name",
        label: "name",
        items: []
    };

    for (pos in rows) {
        var row = rows[pos];

        var item = {
            type: "legs",
            name: "item" + pos,
            country: row.country_user,
            stops: [
                {
                    name: "item" + pos + "a",
                    port: {
                        "_reference": row.country_user
                    },
                    date: row.year_search + "-" + row.month_search + "-" + row.day_search,
                    capacity: row.capacity
                },
                {
                    name: "item" + pos + "b",
                    port: {
                        "_reference": row.country_search
                    },
                    date: row.year_search + "-" + row.month_search + "-" + row.day_search,
                    capacity: row.capacity
                }
            ]
        }

        items.items.push(item);
    }

    return items;
}
