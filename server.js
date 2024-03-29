// JavaScript source code
var http = require('http');
var url = require('url');
var fs = require("fs");
var path = require('path');

var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();

var mongoose = require('mongoose');
var dbsArray = [];
var dbsNames = [];
//Event Listener in Server and Triggering Events
var events = require('events');
var event;
var session = require('express-session');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var consolidate = require('consolidate');

var tracker = require('./helpers/tracker.js');
var geoip = require('geoip-lite');
var mainAppConfig = require('./config/main').mainApp;

require('./config/' + mainAppConfig.NODE_ENV);
process.env.NODE_ENV = mainAppConfig.NODE_ENV;

var mainDb = mongoose.createConnection('localhost', 'mainDB');
//var adminDB;
var requestHandler;
var count = 0;
var waitForUpdate = false;
var request = 0;
var curDb = 0;

mainDb.on('error', console.error.bind(console, 'connection error:'));
mainDb.once('open', function callback () {
    console.log("Connection to mainDB is success");
    var adminDB = mainDb.db.admin();
    event = new events.EventEmitter();
    requestHandler = require("./requestHandler.js")(fs, mongoose, event, dbsArray);
    var reg = new RegExp("\demo");
    adminDB.listDatabases(function (err, dbs) {
        if (err) console.log(err);
        if (dbs) {
            dbs.databases.forEach(function (dbName) {
                if (reg.test(dbName.name)) {
                    mainDb.db.db('mainDB').collection('sessions').drop(function (err, ress) {
                        if (err) console.log(err);
                        if (ress) console.log(ress);
                    });
                    mainDb.db.db(dbName.name).command({
                        dropDatabase: 1
                    }, function (err, result) {
                        if (err) console.log(err);
                        if (result) {
                            console.log(result);
                        }
                        ;
                    });

                }

            });
        }
    });
});
var express = require('express');
var app = express();

var MemoryStore = require('connect-mongo')(session);

var sessionConfig = {
    db: mainDb.name,
    host: mainDb.host,
    port: mainDb.port,
    saveUninitialized: false,
    resave: false,
    reapInterval: 500000
};


var allowCrossDomain = function (req, res, next) {

    var allowedHost = [
        '185.2.100.192:8088',
        'localhost:8088',
        '192.168.88.13:8088'
    ];
    //if (allowedHost.indexOf(req.headers.host) !== -1) {
    var browser = req.headers['user-agent'];
    if (/Trident/.test(browser))
        res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    next();
};
app.engine('html', consolidate.swig);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use(logger('dev'));
//app.use(subDomainParser);
app.use(bodyParser.json({strict: false, inflate: false, limit: 1024 * 1024 * 200}));
app.use(bodyParser.urlencoded({extended: false, limit: 1024 * 1024 * 200}));
app.use(cookieParser("CRMkey"));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    name: 'crm',
    secret: 'CRMkey',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore(sessionConfig)
}));

app.get('/', function (req, res) {
    res.sendfile('index.html');
});


app.get('/getDBS', function (req, res) {
    res.send(200, {dbsNames: dbsNames});
});

app.get('/account/authenticated', function (req, res, next) {
    if (req.session && req.session.loggedIn) {
        res.send(200);
    } else {
        res.send(401);
    }
});

app.get('/getModules', function (req, res) {
    requestHandler.getModules(req, res);
});

app.post('/uploadFiles', multipartMiddleware, function (req, res, next) {
    var os = require("os");
    var osType = (os.type().split('_')[0]);
    var dir;
    switch (osType) {
        case "Windows":
        {
            dir = __dirname + "\\uploads\\";
        }
            break;
        case "Linux":
        {
            dir = __dirname + "\/uploads\/";
        }
    }
    fs.readdir(dir, function (err, files) {
        if (err) {
            fs.mkdir(dir, function (errr) {
                if (!errr)
                    dir += req.headers.id;
                fs.mkdir(dir, function (errr) {
                    if (!errr)
                        uploadFileArray(req, res, function (files) {
                            requestHandler.uploadFile(req, res, req.headers.id, files);
                        });
                });
            });
        } else {
            dir += req.headers.id;
            fs.readdir(dir, function (err, files) {
                if (err) {
                    fs.mkdir(dir, function (errr) {
                        if (!errr)
                            uploadFileArray(req, res, function (files) {
                                requestHandler.uploadFile(req, res, req.headers.id, files);
                            });
                    });
                } else {
                    uploadFileArray(req, res, function (files) {
                        requestHandler.uploadFile(req, res, req.headers.id, files);
                    });
                }
            });
        }
    });
});

app.get('/download/:path', function (req, res) {
    var path = req.param('path');
    res.download(__dirname + path);
});

function uploadFileArray (req, res, callback) {
    var files = [];
    if (req.files && !req.files.attachfile.length) {
        req.files.attachfile = [req.files.attachfile];
    }
    var path;
    var os = require("os");
    var osType = (os.type().split('_')[0]);
    req.files.attachfile.forEach(function (item) {
        var localPath;
        switch (osType) {
            case "Windows":
            {
                localPath = __dirname + "\\uploads\\" + req.headers.id;
            }
                break;
            case "Linux":
            {
                localPath = __dirname + "\/uploads\/" + req.headers.id;
            }
        }
        fs.readdir(localPath, function (err, files) {
            if (!err) {
                var k = '';
                var maxK = 0;
                var checkIs = false;
                var attachfileName = item.name.slice(0, item.name.lastIndexOf('.'));
                files.forEach(function (fileName) {
                    if (fileName == item.name) {
                        k = 1;
                        checkIs = true;
                    } else {
                        if ((fileName.indexOf(attachfileName) === 0) &&
                            (fileName.lastIndexOf(attachfileName) === 0) &&
                            (fileName.lastIndexOf(').') !== -1) &&
                            (fileName.lastIndexOf('(') !== -1) &&
                            (fileName.lastIndexOf('(') < fileName.lastIndexOf(').')) &&
                            (attachfileName.length == fileName.lastIndexOf('('))) {
                            var intVal = fileName.slice(fileName.lastIndexOf('(') + 1, fileName.lastIndexOf(').'));
                            k = parseInt(intVal) + 1;
                        }
                    }
                    if (maxK < k) {
                        maxK = k;
                    }
                });
                if (!(maxK == 0) && checkIs) {
                    item.name = attachfileName + '(' + maxK + ')' + item.name.slice(item.name.lastIndexOf('.'));
                }
            }
        });

        fs.readFile(item.path, function (err, data) {
            var shortPas;
            switch (osType) {
                case "Windows":
                {
                    path = __dirname + "\\uploads\\" + req.headers.id + "\\" + item.name;
                    shortPas = "\\uploads\\" + req.headers.id + "\\" + item.name;
                }
                    break;
                case "Linux":
                {
                    path = __dirname + "\/uploads\/" + req.headers.id + "\/" + item.name;
                    shortPas = "\/uploads\/" + req.headers.id + "\/" + item.name;
                }
            }
            fs.writeFile(path, data, function (err) {
                if (!err) {
                    var file = {};
                    file._id = mongoose.Types.ObjectId();
                    file.name = item.name;
                    file.shortPas = encodeURIComponent(shortPas);
                    if (item.size >= 1024) {
                        file.size = (Math.round(item.size / 1024 / 1024 * 1000) / 1000) + '&nbsp;Mb';
                    }
                    else {
                        file.size = (Math.round(item.size / 1024 * 1000) / 1000) + '&nbsp;Kb';
                    }
                    file.uploadDate = new Date();
                    file.uploaderName = req.session.uName;
                    files.push(file);

                    if (files.length == req.files.attachfile.length) {
                        if (callback) {
                            callback(files);
                        }
                    }
                } else {
                    console.log(err);
                    res.send(500);
                }

            });
        });
    });

}

app.post('/uploadApplicationFiles', function (req, res, next) {
    var os = require("os");
    var osType = (os.type().split('_')[0]);
    var dir;
    switch (osType) {
        case "Windows":
        {
            dir = __dirname + "\\uploads\\";
        }
            break;
        case "Linux":
        {
            dir = __dirname + "\/uploads\/";
        }
    }
    fs.readdir(dir, function (err, files) {
        if (err) {
            fs.mkdir(dir, function (errr) {
                if (!errr)
                    dir += req.headers.id;
                fs.mkdir(dir, function (errr) {
                    if (!errr)
                        uploadFileArray(req, res, function (files) {
                            requestHandler.uploadApplicationFile(req, res, req.headers.id, files);
                        });
                });
            });
        } else {
            dir += req.headers.id;
            fs.readdir(dir, function (err, files) {
                if (err) {
                    fs.mkdir(dir, function (errr) {
                        if (!errr)
                            uploadFileArray(req, res, function (files) {
                                requestHandler.uploadApplicationFile(req, res, req.headers.id, files);
                            });
                    });
                } else {
                    uploadFileArray(req, res, function (files) {
                        requestHandler.uploadApplicationFile(req, res, req.headers.id, files);
                    });
                }
            });
        }
    });
});

app.post('/uploadEmployeesFiles', function (req, res, next) {
    var os = require("os");
    var osType = (os.type().split('_')[0]);
    var dir;
    switch (osType) {
        case "Windows":
        {
            dir = __dirname + "\\uploads\\";
        }
            break;
        case "Linux":
        {
            dir = __dirname + "\/uploads\/";
        }
    }
    fs.readdir(dir, function (err, files) {
        if (err) {
            fs.mkdir(dir, function (errr) {
                if (!errr)
                    dir += req.headers.id;
                fs.mkdir(dir, function (errr) {
                    if (!errr)
                        uploadFileArray(req, res, function (files) {
                            requestHandler.uploadEmployeesFile(req, res, req.headers.id, files);
                        });
                });
            });
        } else {
            dir += req.headers.id;
            fs.readdir(dir, function (err, files) {
                if (err) {
                    fs.mkdir(dir, function (errr) {
                        if (!errr)
                            uploadFileArray(req, res, function (files) {
                                requestHandler.uploadEmployeesFile(req, res, req.headers.id, files);
                            });
                    });
                } else {
                    uploadFileArray(req, res, function (files) {
                        requestHandler.uploadEmployeesFile(req, res, req.headers.id, files);
                    });
                }
            });
        }
    });
});

app.post('/uploadProjectsFiles', function (req, res, next) {
    var os = require("os");
    var osType = (os.type().split('_')[0]);
    var dir;
    switch (osType) {
        case "Windows":
        {
            dir = __dirname + "\\uploads\\";
        }
            break;
        case "Linux":
        {
            dir = __dirname + "\/uploads\/";
        }
    }
    fs.readdir(dir, function (err, files) {
        if (err) {
            fs.mkdir(dir, function (errr) {
                if (!errr)
                    dir += req.headers.id;
                fs.mkdir(dir, function (errr) {
                    if (!errr)
                        uploadFileArray(req, res, function (files) {
                            requestHandler.uploadProjectsFiles(req, res, req.headers.id, files);
                        });
                });
            });
        } else {
            dir += req.headers.id;
            fs.readdir(dir, function (err, files) {
                if (err) {
                    fs.mkdir(dir, function (errr) {
                        if (!errr)
                            uploadFileArray(req, res, function (files) {
                                requestHandler.uploadProjectsFiles(req, res, req.headers.id, files);
                            });
                    });
                } else {
                    uploadFileArray(req, res, function (files) {
                        requestHandler.uploadProjectsFiles(req, res, req.headers.id, files);
                    });
                }
            });
        }
    });
});

app.post('/uploadTasksFiles', function (req, res, next) {
    var os = require("os");
    var osType = (os.type().split('_')[0]);
    var dir;
    switch (osType) {
        case "Windows":
        {
            dir = __dirname + "\\uploads\\";
        }
            break;
        case "Linux":
        {
            dir = __dirname + "\/uploads\/";
        }
    }
    fs.readdir(dir, function (err, files) {
        if (err) {
            fs.mkdir(dir, function (errr) {
                if (!errr)
                    dir += req.headers.id;
                fs.mkdir(dir, function (errr) {
                    if (!errr)
                        uploadFileArray(req, res, function (files) {
                            requestHandler.uploadTasksFiles(req, res, req.headers.id, files);
                        });
                });
            });
        } else {
            dir += req.headers.id;
            fs.readdir(dir, function (err, files) {
                if (err) {
                    fs.mkdir(dir, function (errr) {
                        if (!errr)
                            uploadFileArray(req, res, function (files) {
                                requestHandler.uploadTasksFiles(req, res, req.headers.id, files);
                            });
                    });
                } else {
                    uploadFileArray(req, res, function (files) {
                        requestHandler.uploadTasksFiles(req, res, req.headers.id, files);
                    });
                }
            });
        }
    });
});
app.post('/uploadOpportunitiesFiles', function (req, res, next) {
    var os = require("os");
    var osType = (os.type().split('_')[0]);
    var dir;
    switch (osType) {
        case "Windows":
        {
            dir = __dirname + "\\uploads\\";
        }
            break;
        case "Linux":
        {
            dir = __dirname + "\/uploads\/";
        }
    }

    fs.readdir(dir, function (err, files) {
        if (err) {
            fs.mkdir(dir, function (errr) {
                if (!errr)
                    dir += req.headers.id;
                fs.mkdir(dir, function (errr) {
                    if (!errr)
                        uploadFileArray(req, res, function (files) {
                            requestHandler.uploadOpportunitiesFiles(req, res, req.headers.id, files);
                        });
                });
            });
        } else {
            dir += req.headers.id;
            fs.readdir(dir, function (err, files) {
                if (err) {
                    fs.mkdir(dir, function (errr) {
                        if (!errr)
                            uploadFileArray(req, res, function (files) {
                                requestHandler.uploadOpportunitiesFiles(req, res, req.headers.id, files);
                            });
                    });
                } else {
                    uploadFileArray(req, res, function (files) {
                        requestHandler.uploadOpportunitiesFiles(req, res, req.headers.id, files);
                    });
                }
            });
        }
    });
});

app.get('/logout', function (req, res, next) {
    var ip = req.ip;
    var geo = geoip.lookup(ip);

    if (req.session) {
        var dbId = req.session.lastDb - 1;
        dbsArray[dbId].db.dropDatabase(function (err, result) {
            if (err) console.log('error ----' + err);
            if (result) {
                dbsArray[dbId].close();
                dbsArray[dbId] = null;
            }
            ;
        });
        req.session.destroy(function () {
            res.redirect('/#login');

            tracker.track({
                name: 'logout',
                status: 301,
                registrType: process.env.SERVER_TYPE,
                ip: ip,
                country: (geo) ? geo.country : '',
                city: (geo) ? geo.city : '',
                region: geo ? geo.region : '',
                subDomainName: 'demoCRM'
            });

            tracker.track({
                name: 'sessionEnd',
                status: 301,
                registrType: process.env.SERVER_TYPE,
                ip: ip,
                country: (geo) ? geo.country : '',
                city: (geo) ? geo.city : '',
                region: geo ? geo.region : '',
                subDomainName: 'demoCRM'
            });
        });
    }
});
app.post('/login', function (req, res, next) {
    var body = req.body;
    var ip = req.ip;
    var geo = geoip.lookup(ip);

    geo = geo || {};
    geo.city = geo.city || body.city;

    console.log('!!!!!!!!!!!!Request take success!!!!!!!!!!!!!!!!!!!!!!! With Count ' + count);
    var curRequest = ++request;
    var current = new Date();
    //var targetDb = "demo_" + current.valueOf();
    var targetDb = "demo_" + curDb + '_' + current.valueOf();
    var adminDB = mainDb.db.admin();
    var resSended = false;
    var cDb = function () {
        ++count;
        console.log('Request for new login ' + (curDb + 1));

        adminDB.command({
            copydb: 1,
            //fromdb: "EasyERP",
            fromdb: "CRM",
            todb: targetDb
        }, function (err, result) {
            if (err) {
                console.log(err);
            }
            if (result) {
                var dbConnection = mongoose.createConnection('localhost', targetDb, {server: {poolSize: 3}});//{ server: { poolSize: 2 } }
                dbConnection.once('open', function () {
                    //--count;
                    ++curDb;
                    dbConnection.db.collections(function (err, collections) {
                        if (collections && collections.length !== 0) {
                            var colCount = collections.length;
                            var currentDate = new Date().getTime();
                            var startDate = new Date(currentDate - 8 * 1000 * 60 * 60 * 24).getTime();
                            var endDate = new Date(currentDate - 4 * 1000 * 60 * 60 * 24).getTime();

                            collections.forEach(function (collection, colIndex) {
                                collection.find().toArray(function (err, docs) {
                                    if (docs) {
                                        var docCount = docs.length;
                                        if (docs.length === 0 && (colIndex === (colCount - 1)) && waitForUpdate) {
                                            --count;
                                        }
                                        docs.forEach(function (model, docsIndex) {
                                            if (model._id) {
                                                var newCreateDate = new Date(Math.random() * (endDate - startDate) + startDate);
                                                var newEditDate = new Date(Math.random() * (endDate - newCreateDate.getTime()) + newCreateDate.getTime());
                                                collection.update({_id: model._id}, {
                                                    $set: {
                                                        'createdBy.date': newCreateDate,
                                                        'editedBy.date': newEditDate,
                                                        'createdBy.user': "52203e707d4dba8813000003",
                                                        'editedBy.user': "52203e707d4dba8813000003"
                                                    }
                                                }, {multi: true}, function (er, re) {
                                                    if ((colIndex === (colCount - 1)) && (docsIndex === (docCount - 1)) && waitForUpdate) {
                                                        --count;
                                                        console.log(count);
                                                    }
                                                });
                                            }
                                        });
                                    } else {
                                        if (err) {
                                            console.log(err);

                                            if(!resSended){
                                                resSended = true;

                                                res.send(500, {error: 'error'});
                                            }
                                            --count;
                                        }
                                    }
                                });
                            });
                        } else if (err) {
                            console.log(err);


                            if(!resSended){
                                resSended = true;

                                res.send(500, {error: 'error'});
                            }
                            --count;
                        }
                        if (!waitForUpdate)
                            --count;
                    });
                    dbsArray.push(dbConnection);
                    req.session.loggedIn = true;
                    req.session.uId = "52203e707d4dba8813000003";
                    req.session.uName = "admin";
                    req.session.kanbanSettings = {
                        "applications": {
                            "countPerPage": 10
                        },
                        "opportunities": {
                            "countPerPage": 10,
                            "foldWorkflows": [
                                "528cdd2af3f67bc40b000007",
                                "528cde9ef3f67bc40b000008"
                            ]
                        },
                        "tasks": {
                            "countPerPage": 10
                        }
                    };
                    var lastAccess = new Date();
                    req.session.lastAccess = lastAccess;
                    req.session.lastDb = dbsArray.length;

                    if(!resSended){
                        resSended = true;

                        res.send(200, {success: 'Connection success'});
                    }



                    tracker.track({
                        ip: ip,
                        country: geo ? geo.country : '',
                        email: 'demo@crm.com',
                        city: geo ? geo.city : '',
                        region: geo ? geo.region : undefined,
                        name: 'login',
                        status: 200,
                        subDomainName: 'demoCRM',
                        registrType: process.env.SERVER_TYPE
                    });

                    tracker.track({
                        ip: ip,
                        country: geo ? geo.country : '',
                        email: 'demo@crm.com',
                        city: geo ? geo.city : '',
                        region: geo ? geo.region : undefined,
                        name: 'register',
                        status: 200,
                        subDomainName: 'demoCRM',
                        registrType: process.env.SERVER_TYPE
                    });

                    tracker.track({
                        ip: ip,
                        country: geo ? geo.country : '',
                        email: 'demo@crm.com',
                        city: geo ? geo.city : '',
                        region: geo ? geo.region : undefined,
                        name: 'sessionStart',
                        status: 200,
                        subDomainName: 'demoCRM',
                        registrType: process.env.SERVER_TYPE
                    });

                    //remove all dbs creation < 30 min
                    adminDB.listDatabases(function (err, dbs) {
                        if (err) console.log(err);
                        if (dbs) {
                            dbs.databases.forEach(function (dbName) {
                                if (dbName.name.split('_')[2] && (current.valueOf() - (dbName.name.split('_')[2])) > (30 * 60 * 1000)) {
                                    mainDb.db.db(dbName.name).command({
                                        dropDatabase: 1
                                    }, function (err, result) {
                                        if (err) console.log(err);
                                        if (result) {
                                            for (var i in dbsArray) {
                                                if (dbsArray[i] && dbsArray[i].db && dbsArray[i].db.databaseName === dbName.name) {
                                                    dbsArray[i].db.close();
                                                    dbsArray[i] = null;
                                                    console.log('Connection to ' + dbName.name + ' is closed');
                                                }
                                            }
                                        };
                                    });
                                }

                            });
                        }
                    });
                });
                dbConnection.on('error', function (error) {
                    console.log('Error in Binding for error');
                    console.log(error);
                    if(!resSended) {
                        resSended = true;

                        res.send(500, {error: 'error'});
                    }
                });
            }
        });
    };
    if (count < 1) {
        cDb();
    } else {
        var interval = setInterval(function () {
            if (count < 1) {
                cDb();
                console.log('Waiting......' + (((new Date()) - current) / 1000).toFixed(2) + ' seconds in Request# ' + curRequest);
                clearInterval(interval);
            }
        }, 1);
    }
});

app.post('/Users', function (req, res) {
    var data = {};
    data.user = req.body;
    requestHandler.createUser(req, res, data);
});

app.get('/UserWithProfile', function (req, res) {
    var id = req.param('_id');
    requestHandler.getAllUserWithProfile(req, id, res);
});

app.get('/Users', function (req, res) {
    var data = {};
    data.page = req.param('page');
    data.count = req.param('count');
    requestHandler.getUsers(req, res, data);
});

app.get('/currentUser', function (req, res) {
    requestHandler.currentUser(req, res);
});

app.post('/currentUser', function (req, res) {
    var data = {};
    if (req.body.oldpass && req.body.pass) {
        data.changePass = true;
    }
    requestHandler.updateCurrentUser(req, res, data);
});

app.patch('/currentUser/:_id', function (req, res) {
    var data = {};
    if (req.body.oldpass && req.body.pass) {
        data.changePass = true;
    }
    requestHandler.updateCurrentUser(req, res, data);
});

app.get('/UsersForDd', function (req, res) {
    requestHandler.getUsersForDd(req, res);
});

app.get('/Users/:viewType', function (req, res) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    var viewType = req.params.viewType;
    switch (viewType) {
        case "form":
            requestHandler.getUserById(req, res, data);
            break;
        default:
            requestHandler.getFilterUsers(req, res);
            break;
    }
});

app.patch('/Users/:_id', function (req, res) {
    var data = {};
    var id = req.param('_id');
    data.user = req.body;
    requestHandler.updateUser(req, res, id, data);
});

app.delete('/Users/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.removeUser(req, res, id);
});

app.post('/Profiles', function (req, res) {
    var data = {};
    data.profile = req.body;
    requestHandler.createProfile(req, res, data);
});

app.get('/Profiles', function (req, res) {
    requestHandler.getProfile(req, res);
});

app.get('/ProfilesForDd', function (req, res) {
    requestHandler.getProfileForDd(req, res);
});

app.put('/Profiles/:_id', function (req, res) {
    var data = {};
    var id = req.param('_id');
    data.profile = req.body;
    requestHandler.updateProfile(req, res, id, data);
});

app.delete('/Profiles/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.removeProfile(req, res, id);
});

//-----------------END----Users--and Profiles-----------------------------------------------


//-----------------------------getTotalLength---------------------------------------------
app.get('/totalCollectionLength/:contentType', function (req, res, next) {
    switch (req.params.contentType) {
        case ('Persons'):
            requestHandler.customerTotalCollectionLength(req, res);
            break;
        case ('Companies'):
            requestHandler.customerTotalCollectionLength(req, res);
            break;
        case ('ownCompanies'):
            requestHandler.customerTotalCollectionLength(req, res);
            break;
        case ('Projects'):
            requestHandler.projectsTotalCollectionLength(req, res);
            break;
        case ('Tasks'):
            requestHandler.projectsTotalCollectionLength(req, res);
            break;
        case ('Leads'):
            requestHandler.opportunitiesTotalCollectionLength(req, res);
            break;
        case ('Opportunities'):
            requestHandler.opportunitiesTotalCollectionLength(req, res);
            break;
        case ('Employees'):
            requestHandler.employeesTotalCollectionLength(req, res);
            break;
        case ('Applications'):
            requestHandler.employeesTotalCollectionLength(req, res);
            break;
        case ('JobPositions'):
            requestHandler.jobPositionsTotalCollectionLength(req, res);
            break;
        case ('Users'):
            requestHandler.usersTotalCollectionLength(req, res);
            break;
        default:
            next();
    }
});
//------------------------END--getTotalLength---------------------------------------------

//----------------------Accounts----------------------------------------------------------------

app.get('/getPersonsForDd', function (req, res) {
    requestHandler.getPersonsForDd(req, res);
});

app.get('/getPersonAlphabet', function (req, res) {
    requestHandler.getCustomersAlphabet(req, res);
});

app.get('/getPersonsForMiniView', function (req, res) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    requestHandler.getFilterPersonsForMiniView(req, res, data);

});

//--------------------------Customers----------------------------------------------------------     

app.get('/Customer', function (req, res) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    requestHandler.getCustomer(req, res, data);
});

//Get images for persons or companies or owncompanies
app.get('/getCustomersImages', function (req, res) {
    requestHandler.getCustomersImages(req, res);
});

//----------------------------Persons---------------------------------------------------------

app.post('/Persons', function (req, res) {
    var data = {};
    data.person = req.body;
    requestHandler.createPerson(req, res, data);
});

app.get('/Persons/:viewType', function (req, res) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    var viewType = req.params.viewType;
    switch (viewType) {
        case "form":
            requestHandler.getPersonById(req, res, data);
            break;
        default:
            requestHandler.getFilterCustomers(req, res);
            break;
    }
});

app.put('/Persons/:_id', function (req, res) {
    var data = {};
    var id = req.param('_id');
    var remove = req.headers.remove;
    data.person = req.body;
    requestHandler.updatePerson(req, res, id, data, remove);
});

app.patch('/Persons/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.personUpdateOnlySelectedFields(req, res, id, req.body);
});

app.delete('/Persons/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.removePerson(req, res, id);
});

//---------------------------Projects--------------------------------------------------------

app.get('/projectType', function (req, res) {
    requestHandler.getProjectType(req, res);
});


app.get('/Projects/form/:_id', function (req, res) {
    var data = {};
    data.id = req.params._id;
    requestHandler.getProjectsById(req, res, data);
});

app.get('/getProjectsForDd', function (req, res) {
    requestHandler.getProjectsForDd(req, res);
});
app.get('/getProjectPMForDashboard', function (req, res) {
    requestHandler.getProjectPMForDashboard(req, res);
});
app.get('/getProjectStatusCountForDashboard', function (req, res) {
    requestHandler.getProjectStatusCountForDashboard(req, res);
});

app.get('/getProjectByEndDateForDashboard', function (req, res) {
    requestHandler.getProjectByEndDateForDashboard(req, res);
});

app.post('/Projects', function (req, res) {
    var data = {};
    data.project = req.body;
    requestHandler.createProject(req, res, data);
});

app.patch('/Projects/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.updateOnlySelectedFields(req, res, id, req.body);
});

app.put('/Projects/:_id', function (req, res) {
    var data = {};
    var id = req.param('_id');
    var remove = req.headers.remove;
    data.project = req.body;
    requestHandler.updateProject(req, res, id, data, remove);
});
app.delete('/Projects/:_id', function (req, res) {
    var id = req.params._id;
    requestHandler.removeProject(req, res, id);
});

app.get('/Projects/:viewType', function (req, res, next) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    var viewType = req.params.viewType;
    switch (viewType) {
        case "form":
            requestHandler.getProjectsById(req, res, data);
            break;
        case "list":
            requestHandler.getProjectsForList(req, res, data);
            break;
        default:
            requestHandler.getProjects(req, res, data, next);
            break;
    }
});


//--------------Tasks----------------------------------------------------------
app.get('/getTasksLengthByWorkflows', function (req, res) {
    var options = {};
    for (var i in req.query) {
        options[i] = req.query[i];
    }
    requestHandler.getTasksLengthByWorkflows(req, options, res);
});

app.post('/Tasks', function (req, res) {
    var data = {};
    data.task = req.body;
    requestHandler.createTask(req, res, data);
});

app.get('/Tasks/:viewType', function (req, res) {
    var data = req.query;
    var viewType = req.params.viewType;
    switch (viewType) {
        case "form":
            requestHandler.getTaskById(req, res, data);
            break;
        case "list":
            requestHandler.getTasksForList(req, res, data);
            break;
        case "kanban":
            requestHandler.getTasksForKanban(req, res, data);
            break;
    }
});

app.get('/Priority', function (req, res) {
    requestHandler.getTasksPriority(req, res);
});

app.put('/Tasks/:_id', function (req, res) {
    var data = {};
    var id = req.param('_id');
    data.task = req.body;
    var remove = req.headers.remove;
    requestHandler.updateTask(req, res, id, data, remove);
});

app.patch('/Tasks/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.taskUpdateOnlySelectedFields(req, res, id, req.body);
});

app.delete('/Tasks/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.removeTask(req, res, id);
});

//------------------Workflows---------------------------------------------------

app.get('/relatedStatus', function (req, res) {
    var data = {};
    data.type = req.param('type');
    requestHandler.getRelatedStatus(req, res, data);
});

app.get('/Workflows', function (req, res) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    requestHandler.getWorkflow(req, res, data);
});

app.get('/WorkflowContractEnd', function (req, res) {
    var data = {};
    data.id = req.param('id');
    requestHandler.getWorkflowContractEnd(req, res, data);
});

app.get('/WorkflowsForDd', function (req, res) {
    var data = {};
    var type = {};
    type.id = req.param('id');
    data.type = type;
    requestHandler.getWorkflowsForDd(req, res, data);
});

app.get('/taskWorkflows', function (req, res) {
    var data = {};
    var type = {};
    data.mid = req.param('mid');
    type.id = "Task";
    data.type = type;
    requestHandler.getWorkflowsForDd(req, res, data);
});

app.get('/projectWorkflows', function (req, res) {
    var data = {};
    var type = {};
    type.name = 'project';
    type.id = "Project";
    data.type = type;
    requestHandler.getWorkflowsForDd(req, res, data);
});

app.post('/Workflows', function (req, res) {
    var data = {};
    data.mid = req.headers.mid;
    for (var i in req.body) {
        data[i] = req.body[i];
    }
    data._id = req.body.wId;
    requestHandler.createWorkflow(req, res, data);
});

app.put('/Workflows/:_id', function (req, res) {
    var data = {};
    var _id = req.param('_id');
    data.status = req.body.status;
    data.name = req.body.name;
    requestHandler.updateWorkflow(req, res, _id, data);
});

app.patch('/Workflows/:_id', function (req, res) {
    var data = {};
    var _id = req.param('_id');
    for (var i in req.body) {
        data[i] = req.body[i];
    }
    requestHandler.updateWorkflowOnlySelectedField(req, res, _id, data);
});

app.delete('/Workflows/:_id', function (req, res) {
    var _id = req.param('_id');
    requestHandler.removeWorkflow(req, res, _id);
});
//-------------------Companies--------------------------------------------------

app.post('/Companies', function (req, res) {
    var data = {};
    data.company = req.body;
    requestHandler.createCompany(req, res, data);
});
app.get('/CompaniesForDd', function (req, res) {
    requestHandler.getCompaniesForDd(req, res);
});

app.get('/Companies/:viewType', function (req, res) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    var viewType = req.params.viewType;
    switch (viewType) {
        case "form":
            requestHandler.getCompanyById(req, res, data);
            break;
        default:
            requestHandler.getFilterCustomers(req, res);
            break;
    }
});

app.put('/Companies/:_id', function (req, res) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    var id = req.param('_id');
    data.mid = req.headers.mid;
    data.company = req.body;
    var remove = req.headers.remove;
    if (data.company.salesPurchases.salesPerson && (typeof (data.company.salesPurchases.salesPerson) == 'object')) {
        data.company.salesPurchases.salesPerson = data.company.salesPurchases.salesPerson._id;
    }
    if (data.company.salesPurchases.salesTeam && (typeof (data.company.salesPurchases.salesTeam) == 'object')) {
        data.company.salesPurchases.salesTeam = data.company.salesPurchases.salesTeam._id;
    }
    requestHandler.updateCompany(req, res, id, data, remove);
});

app.patch('/Companies/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.companyUpdateOnlySelectedFields(req, res, id, req.body);
});

app.delete('/Companies/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.removeCompany(req, res, id);
});

app.get('/getCompaniesAlphabet', function (req, res) {
    requestHandler.getCustomersAlphabet(req, res);
});

//------------------JobPositions---------------------------------------------------
app.get('/nationality', function (req, res) {
    requestHandler.getNationality(req, res);
});

app.get('/jobType', function (req, res) {
    requestHandler.getJobType(req, res);
});

app.post('/JobPositions', function (req, res) {
    var data = {};
    data.jobPosition = req.body;
    requestHandler.createJobPosition(req, res, data);
});

app.get('/JobPositionForDd', function (req, res) {
    requestHandler.getJobPositionForDd(req, res);
});

app.get('/JobPositions/:viewType', function (req, res) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    var viewType = req.params.viewType;
    switch (viewType) {
        case "form":
            requestHandler.getJobPositionById(req, res, data);
            break;
        default:
            requestHandler.getFilterJobPosition(req, res);
            break;
    }

});

app.patch('/JobPositions/:_id', function (req, res) {
    var data = {};
    var id = req.param('_id');
    data.jobPosition = req.body;
    requestHandler.updateJobPosition(req, res, id, data);
});

app.put('/JobPositions/:_id', function (req, res) {
    var data = {};
    var id = req.param('_id');
    data.jobPosition = req.body;
    requestHandler.updateJobPosition(req, res, id, data);
});

app.delete('/JobPositions/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.removeJobPosition(req, res, id);
});


//------------------Departments---------------------------------------------------
app.get('/Departments', function (req, res) {
    requestHandler.getDepartment(req, res);
});

app.get('/DepartmentsForDd', function (req, res) {
    requestHandler.getDepartmentForDd(req, res);
});

app.post('/Departments', function (req, res) {
    var data = {};
    data.department = req.body;
    requestHandler.createDepartment(req, res, data);
});

app.get('/Departments/:viewType', function (req, res) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    var viewType = req.params.viewType;
    switch (viewType) {
        case "form":
            requestHandler.getDepartmentById(req, res, data);
            break;
        default:
            requestHandler.getCustomDepartment(req, res, data);
            break;
    }

});

app.put('/Departments/:_id', function (req, res) {
    var data = {};
    var id = req.param('_id');
    data.department = req.body;
    requestHandler.updateDepartment(req, res, id, data);
});

app.delete('/Departments/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.removeDepartment(req, res, id);
});
app.get('/getDepartmentsForEditDd', function (req, res) {
    var id = req.param('id');
    requestHandler.getDepartmentForEditDd(req, res, id);
});


//------------------Employee---------------------------------------------------

app.get('/Birthdays', function (req, res) {
    requestHandler.Birthdays(req, res);
});

app.get('/getForDdByRelatedUser', function (req, res) {
    requestHandler.getForDdByRelatedUser(req, res);
});

app.get('/Employees/:viewType', function (req, res) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    var viewType = req.params.viewType;
    switch (viewType) {
        case "list":
            requestHandler.getEmployeesFilter(req, res);
            break;
        case "thumbnails":
            requestHandler.getEmployeesFilter(req, res);
            break;
        case "form":
            requestHandler.getEmployeesById(req, res);
            break;
    }

});

app.post('/Employees', function (req, res) {
    var data = {};
    data.employee = req.body;
    requestHandler.createEmployee(req, res, data);
});

app.put('/Employees/:_id', function (req, res) {
    var data = {};
    var id = req.body._id;
    data.employee = req.body;
});

app.patch('/Employees/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.employeesUpdateOnlySelectedFields(req, res, id, req.body);
});

app.delete('/Employees/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.removeEmployees(req, res, id);
});

app.get('/getSalesPerson', function (req, res) {
    var data = {};
    requestHandler.getPersonsForDd(req, res, data);
});

app.get('/getSalesTeam', function (req, res) {
    requestHandler.getDepartmentForDd(req, res);
});

app.get('/getEmployeesAlphabet', function (req, res) {
    requestHandler.getEmployeesAlphabet(req, res);
});

app.get('/getEmployeesImages', function (req, res) {
    var data = {};
    data.ids = req.param('ids') || [];
    requestHandler.getEmployeesImages(req, res, data);
});

//------------------Applications---------------------------------------------------

app.get('/getApplicationsLengthByWorkflows', function (req, res) {
    requestHandler.getApplicationsLengthByWorkflows(req, res);
});

app.get('/Applications/:viewType', function (req, res) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    var viewType = req.params.viewType;
    switch (viewType) {
        case "form":
            requestHandler.getApplicationById(req, res, data);
            break;
        case "list":
            requestHandler.getEmployeesFilter(req, res);
            break;
        case "kanban":
            requestHandler.getApplicationsForKanban(req, res, data);
            break;
    }


});

app.post('/Applications', function (req, res) {
    var data = {};
    data.employee = req.body;
    requestHandler.createApplication(req, res, data);
});

app.put('/Applications/:_id', function (req, res) {
    var data = {};
    var id = req.body._id;
    data.employee = req.body;
    requestHandler.updateApplication(req, res, id, data);
});

app.patch('/Applications/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.aplicationUpdateOnlySelectedFields(req, res, id, req.body);
});

app.delete('/Applications/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.removeApplication(req, res, id);
});

app.get('/Degrees', function (req, res) {
    requestHandler.getDegrees(req, res);
});

app.post('/Degrees', function (req, res) {
    var data = {};
    data.degree = req.body;
    requestHandler.createDegree(req, res, data);
});

app.put('/Degrees/:_id', function (req, res) {
    var data = {};
    var id = req.param('_id');
    data.degree = req.body;
    requestHandler.updateDegree(req, res, id, data);
});

app.delete('/Degrees/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.removeDegree(req, res, id);
});

//----------------------campaign----------------------------------------------------------------
app.get('/Campaigns', function (req, res) {
    requestHandler.getCampaigns(req, res);
});

app.get('/sources', function (req, res) {
    requestHandler.getSources(req, res);
});
app.get('/Languages', function (req, res) {
    requestHandler.getLanguages(req, res);
});

//----------------------Leads----------------------------------------------------------------
app.get('/LeadsForChart', function (req, res) {
    var data = {};
    data.source = req.param('source');
    data.dataRange = req.param('dataRange');
    data.dataItem = req.param('dataItem');
    requestHandler.getLeadsForChart(req, res, data);
});

app.get('/Leads/:viewType', function (req, res) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    var viewType = req.params.viewType;
    switch (viewType) {
        case "form":
            requestHandler.getLeadsById(req, res, data);
            break;
        case "list":
            requestHandler.getFilterOpportunities(req, res);
            break;
    }
});

app.post('/Leads', function (req, res) {
    var data = {};
    data.lead = req.body;
    requestHandler.createLead(req, res, data);
});

app.put('/Leads/:_id', function (req, res) {
    var data = {};
    var id = req.param('_id');
    data.lead = req.body;
    requestHandler.updateLead(req, res, id, data);
});
app.patch('/Leads/:_id', function (req, res) {
    var data = {};
    var id = req.param('_id');
    data.lead = req.body;
    requestHandler.updateLead(req, res, id, data);
});

app.delete('/Leads/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.removeLead(req, res, id);
});

//---------------------Opportunities---------------------
app.post('/Opportunities', function (req, res) {
    var data = {};
    data.opportunitie = req.body;
    requestHandler.createOpportunitie(req, res, data);
});

app.get('/Opportunities/:viewType', function (req, res) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    var viewType = req.params.viewType;
    switch (viewType) {
        case "form":
            requestHandler.getOpportunityById(req, res, data);
            break;
        case "kanban":
            requestHandler.getFilterOpportunitiesForKanban(req, res, data);
            break;
        default:
            requestHandler.getFilterOpportunities(req, res);
    }
});

app.get('/OpportunitiesForMiniView', function (req, res) {
    var data = {};
    for (var i in req.query) {
        data[i] = req.query[i];
    }
    requestHandler.getFilterOpportunitiesForMiniView(req, res, data);

});
app.get('/getLengthByWorkflows', function (req, res) {
    requestHandler.getOpportunitiesLengthByWorkflows(req, res);
});

app.put('/Opportunities/:_id', function (req, res) {
    var data = {};
    var id = req.param('_id');
    data.toBeConvert = req.headers.toBeConvert;
    data.opportunitie = req.body;
    requestHandler.updateOpportunitie(req, res, id, data);
});

app.patch('/Opportunities/:_id', function (req, res) {
    var data = {};
    var id = req.param('_id');
    data.toBeConvert = req.headers.toBeConvert;
    data.opportunitie = req.body;
    requestHandler.opportunitieUpdateOnlySelectedFields(req, res, id, data);
});
app.delete('/Opportunities/:_id', function (req, res) {
    var id = req.param('_id');
    requestHandler.removeOpportunitie(req, res, id);
});
app.get('/:id', function (req, res) {
    var id = req.param('id');
    if (!isNaN(parseFloat(id))) {
        requestHandler.redirectFromModuleId(req, res, id);
    } else {
        res.send(500);
    }
});
app.listen(8088);


console.log("server start");
