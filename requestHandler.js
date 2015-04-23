var requestHandler = function (fs, mongoose, event, dbsArray) {
    var logWriter = require("./Modules/additions/logWriter.js")(fs),
        models = require("./models.js")(dbsArray),
        department = require("./Modules/Department.js")(logWriter, mongoose, models),
        users = require("./Modules/Users.js")(logWriter, mongoose, models, department),
        profile = require("./Modules/Profile.js")(logWriter, mongoose, models, users),
        access = require("./Modules/additions/access.js")(profile.schema, users, models, logWriter),
        employee = require("./Modules/Employees.js")(logWriter, mongoose, event, department, models),
        customer = require("./Modules/Customers.js")(logWriter, mongoose, models, department),
        workflow = require("./Modules/Workflow.js")(logWriter, mongoose, models, event),
        project = require("./Modules/Projects.js")(logWriter, mongoose, department, models, workflow, event),
        jobPosition = require("./Modules/JobPosition.js")(logWriter, mongoose, employee, department, models),
        degrees = require("./Modules/Degrees.js")(logWriter, mongoose, models),
        campaigns = require("./Modules/Campaigns.js")(logWriter, mongoose, models),
        opportunities = require("./Modules/Opportunities.js")(logWriter, mongoose, customer, workflow, department, models, event),
        modules = require("./Modules/Module.js")(logWriter, mongoose, profile, models),
        sources = require("./Modules/Sources.js")(logWriter, mongoose, models),
        languages = require("./Modules/Languages.js")(logWriter, mongoose, models),
        jobType = require("./Modules/JobType.js")(logWriter, mongoose, models),
        nationality = require("./Modules/Nationality.js")(logWriter, mongoose, models),
        birthdays = require("./Modules/Birthdays.js")(logWriter, mongoose, employee, models, event);

    //binding for remove Workflow
    event.on('removeWorkflow', function (req, wId, id) {
        var query;
        switch (wId) {
            case "Opportunities":
            case "Leads":
                query = models.get(req.session.lastDb - 1, "Opportunities", opportunities.opportunitiesSchema);
                break;
            case "Projects":
                query = models.get(req.session.lastDb - 1, "Project", project.ProjectSchema);
                break;
            case "Tasks":
                query = models.get(req.session.lastDb - 1, "Tasks", project.TasksSchema);
                break;
            case "Applications":
                query = models.get(req.session.lastDb - 1, "Employees", employee.employeeSchema);
                break;
            case "Jobpositions":
                query = models.get(req.session.lastDb - 1, 'JobPosition', jobPosition.jobPositionSchema);
                break;

        }
        if (query) {
            query.update({ workflow: id }, { workflow: null }, { multi: true }).exec(function (err, result) {
                if (err) {
                    console.log(err);
                    logWriter.log("Removed workflow update " + err);
                }
            });
        }
    });
    //binding for Sequence
    event.on('updateSequence', function (model, sequenceField, start, end, workflowStart, workflowEnd, isCreate, isDelete, callback) {
        var query;
        var objFind = {};
        var objChange = {};
        if (workflowStart == workflowEnd) {//on one workflow

            if (!(isCreate || isDelete)) {
                var inc = -1;
                if (start > end) {
                    inc = 1;
                    var c = end;
                    end = start;
                    start = c;
                } else {
                    end -= 1;
                }
                objChange = {};
                objFind = { "workflow": workflowStart };
                objFind[sequenceField] = { $gte: start, $lte: end };
                objChange[sequenceField] = inc;
                query = model.update(objFind, { $inc: objChange }, { multi: true });
                query.exec(function (err, res) {
                    if (callback) callback((inc == -1) ? end : start);
                });
            } else {
                if (isCreate) {
                    query = model.count({ "workflow": workflowStart }).exec(function (err, res) {
                        if (callback) callback(res);
                    });
                }
                if (isDelete) {
                    objChange = {};
                    objFind = { "workflow": workflowStart };
                    objFind[sequenceField] = { $gt: start };
                    objChange[sequenceField] = -1;
                    query = model.update(objFind, { $inc: objChange }, { multi: true });
                    query.exec(function (err, res) {
                        if (callback) callback(res);
                    });
                }
            }
        } else {//between workflow
            objChange = {};
            objFind = { "workflow": workflowStart };
            objFind[sequenceField] = { $gte: start };
            objChange[sequenceField] = -1;
            query = model.update(objFind, { $inc: objChange }, { multi: true });
            query.exec();
            objFind = { "workflow": workflowEnd };
            objFind[sequenceField] = { $gte: end };
            objChange[sequenceField] = 1;
            query = model.update(objFind, { $inc: objChange }, { multi: true });
            query.exec(function (err, res) {
                if (callback) callback(end);
            });


        }
    });

    Array.prototype.objectID = function () {

        var _arrayOfID = [];
        var newObjectId = mongoose.Types.ObjectId;
        for (var i = 0; i < this.length; i++) {
            if (this[i] && typeof this[i] == 'object' && this[i].hasOwnProperty('_id')) {
                _arrayOfID.push(this[i]._id);
            } else {
                if (typeof this[i] == 'string' && this[i].length === 24) {
                    _arrayOfID.push(newObjectId(this[i]));
                }
                if (this[i] === null) {
                    _arrayOfID.push(null);
                }

            }
        }
        return _arrayOfID;
    };

    Array.prototype.getShowmore = function (countPerPage) {
        var showMore = false;
        for (var i = 0; i < this.length; i++) {
            if (this[i].count > countPerPage) {
                showMore = true;
            }
        }
        return showMore;
    };

    function getModules(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            models.get(req.session.lastDb - 1, 'Users', users.schema).findById(req.session.uId, function (err, _user) {
                if (_user) {
                    modules.get(req, _user.profile, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function redirectFromModuleId(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            models.get(req.session.lastDb - 1, 'Users', users.schema).findById(req.session.uId, function (err, _user) {
                if (_user) {
                    modules.redirectToUrl(req, _user.profile, res, id);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function login(req, res, data) {
        users.login(req, data, res);
    };

    // Get users Total count
    function usersTotalCollectionLength(req, res) {
        users.getTotalCount(req, res);
    }

    function createUser(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 7, function (access) {
                if (access) {
                    users.createUser(req, data.user, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function getUsers(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            users.getUsers(req, res, data);
        } else {
            res.send(401);
        }
    };

    function getAllUserWithProfile(req, id, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            users.getAllUserWithProfile(req, id, res);
        } else {
            res.send(401);
        }
    };

    function currentUser(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            users.getUserById(req, req.session.uId, res);
        } else {
            res.send(401);
        }
    };

    function getUsersForDd(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            users.getUsersForDd(req, res);
        } else {
            res.send(401);
        }
    };

    // Get users for list
    function getFilterUsers(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 7, function (access) {
                if (access) {
                    users.getFilter(req, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function getUserById(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 7, function (access) {
                if (access) {
                    users.getUserById(req, data.id, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function updateCurrentUser(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 7, function (access) {
                if (access) {
                    users.updateUser(req, req.session.uId, req.body, res, data);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function updateUser(req, res, id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 7, function (access) {
                if (access) {
                    users.updateUser(req, id, data.user, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function removeUser(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getDeleteAccess(req, req.session.uId, 7, function (access) {
                if (access) {
                    users.removeUser(req, id, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    //---------------------Profile--------------------------------
    function createProfile(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 51, function (access) {
                if (access) {
                    profile.createProfile(req, data.profile, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function getProfile(req, res) {
        try {
            if (req.session && req.session.loggedIn && req.session.lastDb) {
                access.getReadAccess(req, req.session.uId, 51, function (access) {
                    if (access) {
                        profile.getProfile(req, res);
                    } else {
                        res.send(403);
                    }
                });

            } else {
                res.send(401);
            }
        }
        catch (Exception) {
            console.log("requestHandler.js  " + Exception);
        }
    };

    function getProfileForDd(req, res) {
        try {
            if (req.session && req.session.loggedIn && req.session.lastDb) {
                profile.getProfileForDd(req, res);
            } else {
                res.send(401);
            }
        }
        catch (Exception) {
            console.log("requestHandler.js  " + Exception);
        }
    };

    function updateProfile(req, res, id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 51, function (access) {
                if (access) {
                    profile.updateProfile(req, id, data.profile, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function removeProfile(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getDeleteAccess(req, req.session.uId, 51, function (access) {
                if (access) {
                    profile.removeProfile(req, id, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    //---------------Persons--------------------------------
    function getForDdByRelatedUser(req, res) {
        try {
            if (req.session && req.session.loggedIn && req.session.lastDb) {
                employee.getForDdByRelatedUser(req, req.session.uId, res);
            } else {
                res.send(401);
            }
        }
        catch (Exception) {
            errorLog("requestHandler.js  " + Exception);
        }
    };

    function Birthdays(req, res) {
        try {
            if (req.session && req.session.loggedIn && req.session.lastDb) {
                birthdays.get(req, res);
            } else {
                res.send(401);
            }
        }
        catch (Exception) {
            errorLog("requestHandler.js  " + Exception);
        }
    };

    function getPersonsForDd(req, res) {
        try {
            if (req.session && req.session.loggedIn && req.session.lastDb) {
                employee.getForDd(req, res);
            } else {
                res.send(401);
            }
        }
        catch (Exception) {
            errorLog("requestHandler.js  " + Exception);
        }
    };

    function getFilterPersonsForMiniView(req, res, data) {
        try {
            if (req.session && req.session.loggedIn && req.session.lastDb) {
                customer.getFilterPersonsForMiniView(req, res, data);
            } else {
                res.send(401);
            }
        }
        catch (Exception) {
            errorLog("requestHandler.js  " + Exception);
        }
    };

    function getCustomer(req, res, data) {
        try {
            if (req.session && req.session.loggedIn && req.session.lastDb) {
                customer.getCustomers(req, res, data);
            } else {
                res.send(401);
            }
        }
        catch (Exception) {
            errorLog("requestHandler.js  " + Exception);
            res.send(500, { error: Exception });
        }
    };

    function getPersonById(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 49, function (access) {
                if (access) {
                    customer.getPersonById(req, data.id, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function createPerson(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 49, function (access) {
                if (access) {
                    data.person.uId = req.session.uId;
                    customer.create(req, data.person, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function updatePerson(req, res, id, data, remove) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 49, function (access) {
                if (access) {
                    data.person.editedBy = {
                        user: req.session.uId,
                        date: new Date().toISOString()
                    }
                    customer.update(req, id, remove, data.person, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };
    function personUpdateOnlySelectedFields(req, res, id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 49, function (access) {
                if (access) {
                    data.editedBy = {
                        user: req.session.uId,
                        date: new Date().toISOString()
                    };
                    customer.updateOnlySelectedFields(req, id, data, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    }

    function uploadFile(req, res, id, file) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 49, function (access) {
                if (access) {
                    models.get(req.session.lastDb - 1, "Customers", customer.schema).findByIdAndUpdate(id, { $push: { attachments: { $each: file } } }, function (err, response) {
                        if (err) {
                            res.send(401);
                        } else {
                            res.send(200, { success: 'Customers updated success', data: response });
                        }
                    });
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function removePerson(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getDeleteAccess(req, req.session.uId, 49, function (access) {
                if (access) {
                    customer.remove(req, id, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };


    //---------------------Project--------------------------------
    function createProject(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 39, function (access) {
                if (access) {
                    data.project.uId = req.session.uId;
                    project.create(req, data.project, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function updateOnlySelectedFields(req, res, id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 39, function (access) {
				if (access) {
					data.editedBy = {
						user: req.session.uId,
						date: new Date().toISOString()
					};
					project.updateOnlySelectedFields(req, id, data, res);
				} else {
					res.send(403);
				}
			});
        } else {
            res.send(401);
        }
    }

    function getProjectType(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            project.getProjectType(req, res);
        } else {
            res.send(401);
        }
    }

    function getProjects(req, res, data, next) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 39, function (access) {
                if (access) {
                    data.uId = req.session.uId;
                    project.get(req, data, res, next);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };
    function getProjectPMForDashboard(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 39, function (access) {
                if (access) {
                    project.getProjectPMForDashboard(req, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function getProjectByEndDateForDashboard(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 39, function (access) {
                if (access) {
                    project.getProjectByEndDateForDashboard(req, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function getProjectStatusCountForDashboard(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 39, function (access) {
                if (access) {
                    project.getProjectStatusCountForDashboard(req, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function getProjectsForList(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 39, function (access) {
                if (access) {
                    data.uId = req.session.uId;
                    project.getProjectsForList(req, data, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function getProjectsById(req, res, data) {

        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 39, function (access) {
                if (access) {
                    project.getById(req, data, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function getProjectsForDd(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            project.getForDd(req, res);
        } else {
            res.send(401);
        }
    };

    function updateProject(req, res, id, data, remove) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 39, function (access) {
                if (access) {
                    data.project.editedBy = {
                        user: req.session.uId,
                        date: new Date().toISOString()
                    }
                    project.update(req, id, data.project, res, remove);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function uploadProjectsFiles(req, res, id, file) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 39, function (access) {
                if (access) {
                    project.update(req, id, { $push: { attachments: { $each: file } } }, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function removeProject(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getDeleteAccess(req, req.session.uId, 39, function (access) {
                if (access) {
                    project.remove(req, id, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    //---------------------Tasks-------------------------------
    function createTask(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 40, function (access) {
                if (access) {
                    data.task.uId = req.session.uId;
                    project.createTask(req, data.task, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function getTasksLengthByWorkflows(req, options, res) {
        project.getCollectionLengthByWorkflows(req, options, res);
    }

    function getTaskById(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 40, function (access) {
                if (access) {
                    project.getTaskById(req, data, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }

    };

    function getTasksForList(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 40, function (access) {
                if (access) {
                    project.getTasksForList(req, data, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }

    };

    function getTasksForKanban(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 40, function (access) {
                if (access) {
                    project.getTasksForKanban(req, data, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }

    };

    function removeTask(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getDeleteAccess(req, req.session.uId, 40, function (access) {
                if (access) {
                    project.removeTask(req, id, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function updateTask(req, res, id, data, remove) {
        var date = Date.now();
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 40, function (access) {
                if (access) {
                    data.task['editedBy'] = {
                        user: req.session.uId,
                        date: date
                    };
                    project.updateTask(req, id, data.task, res, remove);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function taskUpdateOnlySelectedFields(req, res, id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 40, function (access) {
                if (access) {
                    data.editedBy = {
                        user: req.session.uId,
                        date: new Date().toISOString()
                    };
                    project.taskUpdateOnlySelectedFields(req, id, data, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    }

    function uploadTasksFiles(req, res, id, file) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 40, function (access) {
                if (access) {
                    project.addAtachments(req, id, { $push: { attachments: { $each: file } } }, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function getTasksPriority(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            project.getTasksPriority(req, res);
        } else {
            res.send(401);
        }
    };

    //------------------Workflow---------------------------------

    function getRelatedStatus(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            workflow.getRelatedStatus(req, res, data);
        } else {
            res.send(401);
        }
    };

    function getWorkflow(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 44, function (access) {
                if (access) {
                    workflow.get(req, data, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function getWorkflowsForDd(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            workflow.getWorkflowsForDd(req, data, res);
        } else {
            res.send(401);
        }
    };

    function createWorkflow(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 44, function (access) {
                if (access) {
                    workflow.create(req, data, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function updateWorkflow(req, res, _id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 44, function (access) {
                if (access) {
                    workflow.update(req, _id, data, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function updateWorkflowOnlySelectedField(req, res, _id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 44, function (access) {
                if (access) {
                    workflow.updateOnlySelectedFields(req, _id, data, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function removeWorkflow(req, res, _id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getDeleteAccess(req, req.session.uId, 50, function (access) {
                if (access) {
                    workflow.remove(req, _id, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    //---------------------Companies-------------------------------

    function getCompaniesForDd(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            customer.getCompaniesForDd(req, res);

        } else {
            res.send(401);
        }
    };

    function getCompanyById(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 50, function (access) {
                if (access) {
                    customer.getCompanyById(req, data.id, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function removeCompany(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getDeleteAccess(req, req.session.uId, 50, function (access) {
                if (access) {
                    customer.remove(req, id, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function createCompany(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            data.company.uId = req.session.uId;
            access.getEditWritAccess(req, req.session.uId, 50, function (access) {
                if (access) {
                    customer.create(req, data.company, res);

                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function updateCompany(req, res, id, data, remove) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            var date = mongoose.Schema.Types.Date;
            data.company.editedBy = {
                user: req.session.uId,
                date: new Date().toISOString()
            }
            access.getEditWritAccess(req, req.session.uId, 50, function (access) {
                if (access) {
                    customer.update(req, id, remove, data.company, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };
    function companyUpdateOnlySelectedFields(req, res, id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 50, function (access) {
                if (access) {
                    data.editedBy = {
                        user: req.session.uId,
                        date: new Date().toISOString()
                    };
                    customer.updateOnlySelectedFields(req, id, data, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    }

    // Get  Persons or Companies or ownCompanies for list and thumbnail
    function getFilterCustomers(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 50, function (access) {
                if (access) {
                    customer.getFilterCustomers(req, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    // Get  Persons or Companies or ownCompanies images for thumbnails
    function getCustomersImages(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 43, function (access) {
                if (access) {
                    customer.getCustomersImages(req, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    // Get Alphabet for Companies or ownCompanies or Persons
    function getCustomersAlphabet(req, res) {
        try {
            if (req.session && req.session.loggedIn && req.session.lastDb) {
                customer.getCustomersAlphabet(req, res);
            } else {
                res.send(401);
            }
        }
        catch (Exception) {
            console.log("requestHandler.js  " + Exception);
        }
    };

    //---------------------JobPosition--------------------------------

    // get  jobPositions Total count
    function jobPositionsTotalCollectionLength(req, res) {
        jobPosition.getTotalCount(req, res);
    }

    function createJobPosition(req, res, data) {

        if (req.session && req.session.loggedIn && req.session.lastDb) {
            data.jobPosition.uId = req.session.uId;
            access.getEditWritAccess(req, req.session.uId, 14, function (access) {
                if (access) {
                    jobPosition.create(req, data.jobPosition, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function getJobType(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            jobType.getForDd(req, res);
        } else {
            res.send(401);
        }
    }
    function getNationality(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            nationality.getForDd(req, res);
        } else {
            res.send(401);
        }
    }

    function getJobPositionForDd(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            jobPosition.getJobPositionForDd(req, res);
        } else {
            res.send(401);
        }
    };

    // Get JobPosition for list
    function getFilterJobPosition(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 14, function (access) {
                if (access) {
                    jobPosition.getFilter(req, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function getJobPositionById(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 14, function (access) {
                if (access) {
                    jobPosition.getJobPositionById(req, data.id, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }

    };

    function updateJobPosition(req, res, id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            data.jobPosition.editedBy = {
                user: req.session.uId,
                date: new Date().toISOString()
            }
            access.getEditWritAccess(req, req.session.uId, 14, function (access) {
                if (access) {
                    jobPosition.update(req, id, data.jobPosition, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function removeJobPosition(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getDeleteAccess(req, req.session.uId, 14, function (access) {
                if (access) {
                    jobPosition.remove(req, id, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    //---------------------Employee--------------------------------

    function employeesTotalCollectionLength(req, res) {
        employee.getTotalCount(req, res);
    }
    function createEmployee(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 42, function (access) {
                if (access) {
                    data.employee.uId = req.session.uId;
                    employee.create(req, data.employee, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function uploadEmployeesFile(req, res, id, files) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 42, function (access) {
                if (access) {
                    employee.addAtach(req, id, files, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    // get employee or Applications for list or thumbnails
    function getEmployeesFilter(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 42, function (access) {
                if (access) {
                    employee.getFilter(req, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    }

    // Get Employee form by employee id
    function getEmployeesById(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 42, function (access) {
                if (access) {
                    employee.getById(req, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }

    };

    function updateEmployees(req, res, id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 42, function (access) {
                if (access) {
                    data.employee.editedBy = {
                        user: req.session.uId,
                        date: new Date().toISOString()
                    };

                    employee.update(req, id, data.employee, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };
    function employeesUpdateOnlySelectedFields(req, res, id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 42, function (access) {
                if (access) {
                    data.editedBy = {
                        user: req.session.uId,
                        date: new Date().toISOString()
                    };
                    employee.updateOnlySelectedFields(req, id, data, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    }
    function removeEmployees(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getDeleteAccess(req, req.session.uId, 42, function (access) {
                if (access) {
                    employee.remove(req, id, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };
    function getEmployeesAlphabet(req, res) {
        try {
            if (req.session && req.session.loggedIn && req.session.lastDb) {
                employee.getEmployeesAlphabet(req, res);
            } else {
                res.send(401);
            }
        }
        catch (Exception) {
            console.log("requestHandler.js  " + Exception);
        }
    };



    //---------------------Application--------------------------------
    function getApplicationsLengthByWorkflows(req, res) {
        employee.getCollectionLengthByWorkflows(req, res);
    }

    function createApplication(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 43, function (access) {
                if (access) {
                    data.employee.uId = req.session.uId;
                    employee.create(req, data.employee, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function getApplicationById(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 43, function (access) {
                if (access) {
                    employee.getById(req, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function getApplicationsForKanban(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 43, function (access) {
                if (access) {
                    employee.getApplicationsForKanban(req, data, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function getEmployeesImages(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 43, function (access) {
                if (access) {
                    employee.getEmployeesImages(req, data, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function updateApplication(req, res, id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 43, function (access) {
                if (access) {
                    data.employee.editedBy = {
                        user: req.session.uId,
                        date: new Date().toISOString()
                    }

                    employee.update(req, id, data.employee, res);
                } else {
                    res.send(403);
                }
            })

        } else {
            res.send(401);
        }
    };

    function uploadApplicationFile(req, res, id, files) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 43, function (access) {
                if (access) {
                    employee.addAtach(req, id, files, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };
    function aplicationUpdateOnlySelectedFields(req, res, id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 43, function (access) {
                if (access) {
                    data.editedBy = {
                        user: req.session.uId,
                        date: new Date().toISOString()
                    };
                    employee.updateOnlySelectedFields(req, id, data, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    }
    function removeApplication(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getDeleteAccess(req, req.session.uId, 43, function (access) {
                if (access) {
                    employee.remove(req, id, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    //---------------------Department--------------------------------
    function createDepartment(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            data.department.uId = req.session.uId;
            access.getEditWritAccess(req, req.session.uId, 15, function (access) {
                if (access) {
                    department.create(req, data.department, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    }

    function getDepartment(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 15, function (access) {
                if (access) {
                    department.get(req, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    }

    function updateDepartment(req, res, id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            data.department.editedBy = {
                user: req.session.uId,
                date: new Date().toISOString()
            }
            access.getEditWritAccess(req, req.session.uId, 15, function (access) {
                if (access) {
                    department.update(req, id, data.department, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    }

    function removeDepartment(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getDeleteAccess(req, req.session.uId, 15, function (access) {
                if (access) {
                    department.remove(req, id, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    }

    function getDepartmentForDd(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            department.getForDd(req, res);
        } else {
            res.send(401);
        }
    }

    function getDepartmentForEditDd(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            department.getForEditDd(req, id, res);
        } else {
            res.send(401);
        }
    }

    function getCustomDepartment(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 15, function (access) {
                if (access) {
                    department.getCustomDepartment(req, data, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    };

    function getDepartmentById(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 15, function (access) {
                if (access) {
                    department.getDepartmentById(req, data.id, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }

    };
    
	//---------------------Deegree--------------------------------
    function createDegree(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            degrees.create(req, data.degree, res);
        } else {
            res.send(401);
        }
    }

    function getDegrees(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            degrees.get(req, res);
        } else {
            res.send(401);
        }
    }

    function updateDegree(req, res, id, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            degrees.update(req, id, data.degree, res);
        } else {
            res.send(401);
        }
    }

    function removeDegree(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            degrees.remove(req, id, res);
        } else {
            res.send(401);
        }
    }
    //-----------------Campaigns--------------------------------------
    function getCampaigns(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            campaigns.getForDd(req, res);
        } else {
            res.send(401);
        }
    }

    function getLeadsById(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 24, function (access) {
                if (access) {
                    opportunities.getById(req, data.id, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    }

    function createLead(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            data.lead.uId = req.session.uId;
            access.getEditWritAccess(req, req.session.uId, 24, function (access) {
                if (access) {
                    opportunities.create(req, data.lead, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    }

    function updateLead(req, res, id, data) {
        var date = Date.now();
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            data.lead['editedBy'] = {
                user: req.session.uId,
                date: date
            };
            access.getEditWritAccess(req, req.session.uId, 24, function (access) {
                if (access) {
                    opportunities.updateLead(req, id, data.lead, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    }

    function removeLead(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getDeleteAccess(req, req.session.uId, 24, function (access) {
                if (access) {
                    opportunities.remove(req, id, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    }

    function getLeadsForChart(req, res, data) {
        if (req.session && req.session.loggedIn) {
            access.getReadAccess(req, req.session.uId, 24, function (access) {
                if (access) {
                    opportunities.getLeadsForChart(req, res, data);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    }
    //-------------------Opportunities---------------------------

    // Get  Leads or Opportunities for List
    function getFilterOpportunities(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 24, function (access) {
                if (access) {
                    opportunities.getFilter(req, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    }

    // Get  Leads or Opportunities total count
    function opportunitiesTotalCollectionLength(req, res) {
        opportunities.getTotalCount(req, res);
    }

    function getOpportunitiesLengthByWorkflows(req, res) {
        opportunities.getCollectionLengthByWorkflows(req, res);
    }

    function createOpportunitie(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            data.opportunitie.uId = req.session.uId;
            access.getEditWritAccess(req, req.session.uId, 25, function (access) {
                if (access) {
                    opportunities.create(req, data.opportunitie, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    }

    function getOpportunityById(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 25, function (access) {
                if (access) {
                    opportunities.getById(req, data.id, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    }

    function getFilterOpportunitiesForMiniView(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 25, function (access) {
                if (access) {
                    opportunities.getFilterOpportunitiesForMiniView(req, data, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };


    function getFilterOpportunitiesForKanban(req, res, data) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getReadAccess(req, req.session.uId, 25, function (access) {
                if (access) {
                    opportunities.getFilterOpportunitiesForKanban(req, data, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function updateOpportunitie(req, res, id, data) {
        var date = Date.now();
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            data.opportunitie['editedBy'] = {
                user: req.session.uId,
                date: date
            };
            access.getEditWritAccess(req, req.session.uId, 25, function (access) {
                if (access) {
                    opportunities.update(req, id, data.opportunitie, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    }

    function opportunitieUpdateOnlySelectedFields(req, res, id, data) {
        data = data.opportunitie;
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 25, function (access) {
                if (access) {
                    data.editedBy = {
                        user: req.session.uId,
                        date: new Date().toISOString()
                    };
                    opportunities.updateOnlySelectedFields(req, id, data, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    }

    function removeOpportunitie(req, res, id) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getDeleteAccess(req, req.session.uId, 25, function (access) {
                if (access) {
                    opportunities.remove(req, id, res);
                } else {
                    res.send(403);
                }
            });

        } else {
            res.send(401);
        }
    }

    function uploadOpportunitiesFiles(req, res, id, file) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            access.getEditWritAccess(req, req.session.uId, 39, function (access) {
                if (access) {
                    opportunities.update(req, id, { $push: { attachments: { $each: file } } }, res);
                } else {
                    res.send(403);
                }
            });
        } else {
            res.send(401);
        }
    };

    function getSources(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            sources.getForDd(req, res);
        } else {
            res.send(401);
        }
    }
    function getLanguages(req, res) {
        if (req.session && req.session.loggedIn && req.session.lastDb) {
            languages.getForDd(req, res);
        } else {
            res.send(401);
        }
    }

    // Get  Persons or Companies or ownCompanies total count
    function customerTotalCollectionLength(req, res) {
        customer.getTotalCount(req, res);
    }
    function projectsTotalCollectionLength(req, res) {
        project.getTotalCount(req, res);
    }
    return {

        mongoose: mongoose,
        getModules: getModules,
        redirectFromModuleId: redirectFromModuleId,

        login: login,
        createUser: createUser,
        usersTotalCollectionLength: usersTotalCollectionLength,
        getUsers: getUsers,
        getUsersForDd: getUsersForDd,
        getUserById: getUserById,
        getFilterUsers: getFilterUsers,
        getAllUserWithProfile: getAllUserWithProfile,
        updateUser: updateUser,
        removeUser: removeUser,
        currentUser: currentUser,
        updateCurrentUser: updateCurrentUser,

        getProfile: getProfile,
        getProfileForDd: getProfileForDd,
        createProfile: createProfile,
        updateProfile: updateProfile,
        removeProfile: removeProfile,

        createPerson: createPerson,
        getPersonById: getPersonById,
        updatePerson: updatePerson,
        removePerson: removePerson,
        uploadFile: uploadFile,
        getCustomer: getCustomer,
        getFilterPersonsForMiniView: getFilterPersonsForMiniView,
        personUpdateOnlySelectedFields: personUpdateOnlySelectedFields,

        projectsTotalCollectionLength: projectsTotalCollectionLength,//for Showmore and Lists
        getProjects: getProjects,//for Thumbnails
        getProjectsForList: getProjectsForList,
        getProjectsById: getProjectsById,//Used for Edit view
        getProjectsForDd: getProjectsForDd,
        createProject: createProject,
        updateProject: updateProject,
        uploadProjectsFiles: uploadProjectsFiles,
        removeProject: removeProject,
        getProjectPMForDashboard: getProjectPMForDashboard,
        getProjectStatusCountForDashboard: getProjectStatusCountForDashboard,
        getProjectByEndDateForDashboard: getProjectByEndDateForDashboard,
        updateOnlySelectedFields: updateOnlySelectedFields,
        taskUpdateOnlySelectedFields: taskUpdateOnlySelectedFields,
        getProjectType: getProjectType,

        createTask: createTask,
        getTasksLengthByWorkflows: getTasksLengthByWorkflows,
        getTaskById: getTaskById,
        getTasksForList: getTasksForList,
        getTasksForKanban: getTasksForKanban,
        updateTask: updateTask,
        uploadTasksFiles: uploadTasksFiles,
        removeTask: removeTask,
        getTasksPriority: getTasksPriority,

        getCompaniesForDd: getCompaniesForDd,
        getCompanyById: getCompanyById,
        removeCompany: removeCompany,
        createCompany: createCompany,
        updateCompany: updateCompany,
        companyUpdateOnlySelectedFields: companyUpdateOnlySelectedFields,
        getFilterCustomers: getFilterCustomers,
        getCustomersImages: getCustomersImages,
        getCustomersAlphabet: getCustomersAlphabet,

        getRelatedStatus: getRelatedStatus,
        getWorkflow: getWorkflow,
        createWorkflow: createWorkflow,
        updateWorkflow: updateWorkflow,
        getWorkflowsForDd: getWorkflowsForDd,
        removeWorkflow: removeWorkflow,
        updateWorkflowOnlySelectedField: updateWorkflowOnlySelectedField,

        jobPositionsTotalCollectionLength: jobPositionsTotalCollectionLength,
        createJobPosition: createJobPosition,
        updateJobPosition: updateJobPosition,
        removeJobPosition: removeJobPosition,
        getJobPositionById: getJobPositionById,
        getJobPositionForDd: getJobPositionForDd,

        createEmployee: createEmployee,
        getFilterJobPosition: getFilterJobPosition,
        getForDdByRelatedUser: getForDdByRelatedUser,
        getEmployeesById: getEmployeesById,
        removeEmployees: removeEmployees,
        updateEmployees: updateEmployees,
        getEmployeesAlphabet: getEmployeesAlphabet,
        getEmployeesImages: getEmployeesImages,

        Birthdays: Birthdays,

        getPersonsForDd: getPersonsForDd,
        getDepartmentForDd: getDepartmentForDd,

        getApplicationsLengthByWorkflows: getApplicationsLengthByWorkflows,
        createApplication: createApplication,
        removeApplication: removeApplication,
        updateApplication: updateApplication,
        uploadApplicationFile: uploadApplicationFile,
        aplicationUpdateOnlySelectedFields: aplicationUpdateOnlySelectedFields,
        employeesUpdateOnlySelectedFields: employeesUpdateOnlySelectedFields,

        getDepartment: getDepartment,
        createDepartment: createDepartment,
        updateDepartment: updateDepartment,
        removeDepartment: removeDepartment,
        getDepartmentById: getDepartmentById,
        getCustomDepartment: getCustomDepartment,
        getDepartmentForEditDd: getDepartmentForEditDd,
        createDegree: createDegree,
        getDegrees: getDegrees,
        updateDegree: updateDegree,
        removeDegree: removeDegree,

        getCampaigns: getCampaigns,
        employeesTotalCollectionLength: employeesTotalCollectionLength,
        getEmployeesFilter: getEmployeesFilter,
        uploadEmployeesFile: uploadEmployeesFile,
        getApplicationById: getApplicationById,
        getApplicationsForKanban: getApplicationsForKanban,

        createLead: createLead,
        updateLead: updateLead,
        removeLead: removeLead,
        getLeadsById: getLeadsById,
        getLeadsForChart: getLeadsForChart,

        opportunitiesTotalCollectionLength: opportunitiesTotalCollectionLength,
        getOpportunitiesLengthByWorkflows: getOpportunitiesLengthByWorkflows,
        createOpportunitie: createOpportunitie,
        getFilterOpportunities: getFilterOpportunities,
        getFilterOpportunitiesForMiniView: getFilterOpportunitiesForMiniView,
        getFilterOpportunitiesForKanban: getFilterOpportunitiesForKanban,
        getOpportunityById: getOpportunityById,
        updateOpportunitie: updateOpportunitie,
        removeOpportunitie: removeOpportunitie,
        opportunitieUpdateOnlySelectedFields: opportunitieUpdateOnlySelectedFields,
        uploadOpportunitiesFiles: uploadOpportunitiesFiles,

        getSources: getSources,
        getLanguages: getLanguages,
        getJobType: getJobType,
		getNationality: getNationality,
        customerTotalCollectionLength: customerTotalCollectionLength

    }
}
//---------EXPORTS----------------------------------------
module.exports = requestHandler;
