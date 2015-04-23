var Module = function (logWriter, mongoose, profile, models) {
    var moduleSchema = mongoose.Schema({
        _id: Number,
        mname: String,
        href: { type: String, default: '' },
        ancestors: [Number],
        users: {},
        parrent: Number,
        link: Boolean,
        visible: Boolean
    }, { collection: 'modules' });
    
    mongoose.model('modules', moduleSchema);

    return {
        get: function (req, id, response) {
           
            models.get(req.session.lastDb - 1, "Profile", profile.schema).aggregate(
                {
                    $project: {
                        profileAccess: 1
                    }
                },
                {
                    $match: {
                        _id: id
                    }
                },
                {
                    $unwind: "$profileAccess"
                },

                {
                    $match: {
                        'profileAccess.access.read': true
                    }
                },
                { $group: { _id: "$profileAccess.module" } },

                function (err, result) {
                    if (err) {
                        console.log(err);
                    } else {
                        models.get(req.session.lastDb - 1, "modules", moduleSchema).find().
                            where('_id').in(result).
                            where({ visible: true }).
                            sort({ sequence: 1 }).
                            exec(function (err, mod) {
                                if (mod) {
                                    response.send(mod);
                                } else {
                                    console.log("Node JS error " + err);
                                    response.send(401);
                                }
                            });
                    }
                }
            );
        },
     redirectToUrl: function (req, id, response, parentId) {
            models.get(req.session.lastDb - 1, "Profile", profile.schema).aggregate(
                {
                    $project: {
                        profileAccess: 1
                    }
                },
                {
                    $match: {
                        _id: id
                    }
                },
                {
                    $unwind: "$profileAccess"
                },

                {
                    $match: {
                        'profileAccess.access.read': true
                    }
                },
                { $group: { _id: "$profileAccess.module" } },

                function (err, result) {
                    if (err) {
                        console.log(err);
                    } else {
                        models.get(req.session.lastDb - 1, "modules", moduleSchema).find().
                            where('_id').in(result).
                            where({ visible: true, parrent: parentId }).
                            sort({ sequence: 1 }).
                            exec(function (err, mod) {
                                if (mod) {
                                    response.redirect("/#easyErp/"+mod[0].href);
                                } else {
                                    console.log("Node JS error " + err);
                                    response.send(401);
                                }
                            });
                    }
                }
            );
        },
    };
};

module.exports = Module;
