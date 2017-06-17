var sp_domain = 'samlsp.desmaximus.com';
var saml2 = require('saml2-js');
var fs = require('fs');
var express = require('express');
var app = express();
var ejs = require('ejs');
var bodyParser = require('body-parser')
var session = require('express-session');

app.use(session({
  secret: '2C44-4D44-WppQ38S',
  resave: true,
  saveUninitialized: true
}));

//store for idp urls
var Datastore = require('nedb')
  , db = new Datastore({ filename: './data/idpdata.dat' });
db.loadDatabase(function (err) {    // Callback is optional

});


var multer = require('multer');
//store for idp certificate 
var storage = multer.diskStorage({
  destination: function (request, file, callback) {
    callback(null, './uploads/');
  },
  filename: function (request, file, callback) {
    console.log(file);
    callback(null, "idp_cert.pem")
  }
});
var upload = multer({ storage: storage });
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs'); // set up ejs for templating
app.use(bodyParser.urlencoded({ extended: false }))


// Create service provider
var sp_options = {
  entity_id: "https://" + sp_domain + "/metadata.xml",
  private_key: fs.readFileSync("./certs/sp.pem").toString(),
  certificate: fs.readFileSync("./certs/sp.crt").toString(),
  assert_endpoint: "https://" + sp_domain + "/assert"
};
var sp = new saml2.ServiceProvider(sp_options);

// Endpoint to retrieve metadata
app.get("/metadata.xml", function (req, res) {
  console.log(req);
  res.type('application/xml');
  res.send(sp.create_metadata());
});


var auth = function (req, res, next) {
  if (req.session && req.session.user)
    return next();
  else
    return res.redirect('/login');
};


app.get("/", auth, function (req, res) {
res.render('assert.ejs', {
        nameid: req.session.user.name_id,
        sessionIndex: req.session.user.session_index,
        attributes: req.session.user.attributes

      });
});

app.get("/assert", auth, function (req, res) {
res.redirect('/');
});

// Starting point for login
app.get("/login", function (req, res) {


  var idp_options =
    {
      certificates: [fs.readFileSync("./uploads/idp_cert.pem")]
    };

  var idp = null;

  db.findOne({ idp: 1 }, function (err, doc) {
    idp_options.sso_login_url = doc == null ? '' : doc.login_url;
    idp_options.sso_logout_url = doc == null ? '' : doc.logout_url;
    idp = new saml2.IdentityProvider(idp_options);

    sp.create_login_request_url(idp, {}, function (err, login_url, request_id) {
      if (err != null)
        return res.send(500);
      res.redirect(login_url);
    });

  });



});

app.get('/idp/setup', function (req, res) {
  res.render('setupidp.ejs');
});

app.get('/idp/list', function (req, res) {

  // The same rules apply when you want to only find one document
  db.findOne({ idp: 1 }, function (err, doc) {

    res.render('listidp.ejs', {
      sso_login_url: doc == null ? '' : doc.login_url,
      sso_logout_url: doc == null ? '' : doc.logout_url,
      sso_public_key: doc == null ? '' : fs.readFileSync("./uploads/idp_cert.pem").toString()

    });
  });

});


app.post('/idp/setup', upload.single('idp_public_key'), function (req, res) {
  db.findOne({ idp: 1 }, function (err, doc) {

    if (err) res.json(err);
    if (doc == null) {
      db.insert({ login_url: req.body.sso_login_url, logout_url: req.body.sso_logout_url, idp: 1 }, function (err, newDoc) {   // Callback is optional
        // newDoc is the newly inserted document, including its _id
        // newDoc has no key called notToBeSaved since its value was undefined
        res.redirect('/idp/list');
      });
    }
    else {
      db.update({ idp: 1 }, { login_url: req.body.sso_login_url, logout_url: req.body.sso_logout_url, idp: 1 }, { upsert: true }, function (err, numReplaced, upsert) {
        if (err) res.json(err);
        else res.redirect('/idp/list');
      });
    }

  })

});

// Assert endpoint for when login completes
app.post("/assert", function (req, res) {

  var idp_options =
    {
      certificates: [fs.readFileSync("./uploads/idp_cert.pem")]
    };

  var idp = null;

  db.findOne({ idp: 1 }, function (err, doc) {
    idp_options.sso_login_url = doc == null ? '' : doc.login_url;
    idp_options.sso_logout_url = doc == null ? '' : doc.logout_url;
    idp = new saml2.IdentityProvider(idp_options);

    var options = { request_body: req.body, allow_unencrypted_assertion: true, require_session_index: false };
    sp.post_assert(idp, options, function (err, saml_response) {
      console.log(saml_response.name);
      if (err != null) {
        console.log(err);
        return res.status(500).json(err);
      }

      req.session.user = saml_response.user;
      res.render('assert.ejs', {
        nameid: saml_response.user.name_id,
        sessionIndex: saml_response.user.session_index,
        attributes: saml_response.user.attributes

      });

    });

  });

});

// Starting point for logout
app.get("/logout/:name_id/:session_index", function (req, res) {

  req.session.destroy();

  var idp_options =
    {
      certificates: [fs.readFileSync("./uploads/idp_cert.pem")]
    };

  var idp = null;

  db.findOne({ idp: 1 }, function (err, doc) {
    idp_options.sso_login_url = doc == null ? '' : doc.login_url;
    idp_options.sso_logout_url = doc == null ? '' : doc.logout_url;
    idp = new saml2.IdentityProvider(idp_options);

    var options = {
      name_id: req.params.name_id,
      session_index: req.params.session_index
    };

    sp.create_logout_request_url(idp, options, function (err, logout_url) {
      if (err != null)
        return res.send(500);
      res.redirect(logout_url);
    });
  });



});



function startServer() {
  console.log('starting server...');
  var port = 3001;
  app.listen(port, function () {
    console.log(`started on ${port}`);
  });
}
startServer();

