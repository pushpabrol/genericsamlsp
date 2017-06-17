var express = require('express');
var router = express.Router();


var bodyParser = require('body-parser');
// Create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })

var multer = require('multer')
var upload = multer({ dest: './uploads/' });

//middle ware that is specific to this router
router.use(function timeLog(req, res, next) {
    //console.log('Time: ', Date.now());
    next();
});

//Home page
router.get('/', function (req, res) {
    res.sendFile(__dirname + "/" + "home.htm");
})

//processing GET request
router.get('/process_get', function (req, res) {

    // Prepare output in JSON format
    response = {
        first_name: req.query.first_name,
        last_name: req.query.last_name,
        message: 'Result from a GET request'
    };
    console.log(response);
    res.end(JSON.stringify(response));
})

//processing POST Request
router.post('/process_post', urlencodedParser, function (req, res) {

    // Prepare output in JSON format
    response = {
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        message: 'Result from a POST request'
    };
    console.log(response);
    res.end(JSON.stringify(response));
})

//Multipart request (Accept one file where the name of the form field is named photo)
router.post('/file_upload', upload.single('photo'), function (req, res) {

    console.log(req.body) // form fields

    //console.log(req.body.first_name)
    //console.log(req.body.last_name)

    console.log(req.file) // form files
    res.status(204).end()
});

module.exports = router;
