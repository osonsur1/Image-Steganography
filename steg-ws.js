const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();
const newImgStore = require('img-store');
const imgStore = newImgStore(false);

const Steg = require('steg');
const Ppm = require('ppm');

const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

function serve(port, base, images) {
  const app = express();
  app.locals.port = port;
  app.locals.base = base;
  app.locals.images = images;
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

module.exports = {
  serve: serve
}

/** Prefix for image services */
const IMAGES = 'images'; 

/** Prefix for steganography services */
const STEG = 'steg';

/** Field name for image file upload */
const IMG_FIELD = 'img';

/** Set up routes based on IMAGES and STEG for all URLs to be handled
 *  by this server with all necessary middleware and handlers.
 */
function setupRoutes(app) {
  const base = app.locals.base;
  app.get(`${base}/${IMAGES}/:group/:name/meta`, getMeta(app));
  app.post(`${base}/${IMAGES}/:group`,upload.single('img'), createImage(app));
  app.get(`${base}/${IMAGES}/:group/:filename`,getImage(app))
  app.get(`${base}/${IMAGES}/:group`, listImages(app))
  app.post(`${base}/${STEG}/:group/:name`, stegHide(app))
  app.get(`${base}/${STEG}/:group/:name`, stegUnhide(app));
  

  //TODO: add routes with middleware and handlers for other services.
}

/************************** Image Services *****************************/

/** Given a multipart-form containing a file uploaded for parameter
 *  IMG_FIELD, store contents of file in image store with group
 *  specified by suffix of request URL.  The name of the stored image
 *  is determined automatically by the image store and the type of the
 *  image is determined from the extension of the originalname of the
 *  uploaded file.
 *
 *  If everything is ok, set status of response to CREATED with
 *  Location header set to the URL at which the newly stored image
 *  will be available.  If not ok, set response status to a suitable
 *  HTTP error status and return JSON object with "code" and "message"
 *  properties giving error details.
 */
function createImage(app) {
  return async function(req, res) {
    let group,name,ext,storedFileName

    try{
      group = req.params.group;
      name = req.file.originalname;
      ext = req.file.originalname.slice(-4);
      storedFileName
    
      storedFileName = await (await imgStore).putWithAutoName(group,group+"/"+name);
    }catch(err){
      const mappedErr = mapError(err)
      res.status(mappedErr.status)
      res.json(mappedErr)
    }
    let imageURL =`${req.protocol}://${req.hostname}:${req.app.locals.port}/api/images/${group}/${storedFileName}${ext}`
    res.append('Location', imageURL);
    res.sendStatus(CREATED);
  };
}


/** If everything ok, set response status to OK with body containing
 *  bytes of image representation specified by group/name.ext suffix
 *  of request URL.  If not ok, set response status to a suitable HTTP
 *  error status and return JSON object with "code" and "message"
 *  properties giving error details.
 */
function getImage(app) {
  return async function(req, res) {
    const group = req.params.group;
    const name = req.params.filename.slice(0,-4)
    const ext = req.params.filename.slice(-3)
    let imgBytes
    imgStore.then(async function(result){
      imgBytes = await result.get(group, name, ext)
    },function errorLogFun(err){
      const mappedErr = mapError(err)
      res.status(mappedErr.status)
      res.json(mappedErr)
    }).then(function(){
      res.contentType('application/octet-stream')
      res.end(new Buffer(imgBytes,'binary'),'binary')
    },function errorLogFun(err){
      const mappedErr = mapError(err)
      res.status(mappedErr.status)
      res.json(mappedErr)
    });
  };
}


/** If everything ok, set response status to OK with body containing
 *  JSON of image meta-information specified by group/name of request
 *  URL.  If not ok, set response status to a suitable HTTP error
 *  status and return JSON object with "code" and "message" properties
 *  giving error details.
 */
function getMeta(app) {
  return async function(req, res) {
    try {
      const {group, name} = req.params;
      const meta = await app.locals.images.meta(group, name);
      res.status(OK).json(meta);
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

/** If everything ok, set response status to OK with body containing a
 *  JSON list (possibly empty) of image names for group suffix of
 *  request URL.  If not ok, set response status to a suitable HTTP
 *  error status and return JSON object with "code" and "message"
 *  properties giving error details.
 */
function listImages(app) {
  return async function(req, res) {
    try{
      const group = req.params.group;
      const list = await app.locals.images.list(group)
      res.status(OK).json(list);
    }catch (err) {
      const mapped = mapError(err);
      const list = res.status(mapped.status).json(mapped); 
    }
  }
}


/*********************** Steganography Services ************************/

/** This service is used for hiding a message in the image specified
 *  by its request URL.  It requires a JSON request body with a 
 *  parameter "msg" giving the message to be hidden and a "outGroup"
 *  parameter giving the group of the image being created.  The message
 *  will be hidden in a new image with group set to the value of
 *  "outGroup" and a auto-generated name.
 *
 *  If everything is ok, set the status of the response to CREATED
 *  with Location header set to the URL which can be used to unhide
 *  the hidden message.  If not ok, set response status to a suitable
 *  HTTP error status and return JSON object with "code" and "message"
 *  properties giving error details.
 */
function stegHide(app) {


  return async function(req, res) {

    const group = req.params.group;
    const name = req.params.name;
    const msg = "hello" // Fix this
    const outputGroups = "outputs" // Fix this

    imgStore.then(async function(result){
      imgBytes = await result.get(group, name, "ppm")
      let uintarr = new Uint8Array(imgBytes)
      let ppmObj = new Ppm(outputGroups+"/"+name,uintarr)
      let opPpmObj = new Steg(ppmObj).hide(msg)
      try{
      storedFileName = await (await imgStore).put(outputGroups,"/"+group+"/"+name+".ppm");
res.status(OK).send()
      }catch(err){
        console.log(err)
      }
    }
    

    // app.locals.images.
    )};
}

/** If everything ok, set response status to OK with body containing a
 *  JSON object with property "msg" containing the message hidden in
 *  the image specified by the URL for this request.  If not ok, set
 *  response status to a suitable HTTP error status and return JSON
 *  object with "code" and "message" properties giving error details.
 */
function stegUnhide(app) {
  return async function(req, res) {
    const group = req.params.group;
    const name = req.params.name;

    
    let imgBytes
    imgStore.then(async function(result){
      imgBytes = await result.get(group, name, "ppm")
      let uintarr = new Uint8Array(imgBytes)
      let ppmObj = new Ppm(group+"/"+name,uintarr)
      let msg = new Steg(ppmObj).unhide()
      res.status(OK).send(msg)
    }
    )};
}

/******************************* Utilities *****************************/

/** Given params object containing key: value pairs, return an object
 *  containing a suitable "code" and "message" properties if any value
 *  is undefined; otherwise return falsey.
 */
function checkMissing(params) {
  const missing =
    Object.entries(params).filter(([k, v]) => typeof v === 'undefined')
      .map(([k, v]) => k);
  return missing.length > 0 &&
    { code: 'MISSING',
      message: `field(s) ${missing.join(', ')} not specified`
    };
}



//Object mapping domain error codes to HTTP status codes.
const ERROR_MAP = {
  EXISTS: CONFLICT,
  NOT_FOUND: NOT_FOUND,
  READ_ERROR: SERVER_ERROR,
  WRITE_ERROR: SERVER_ERROR,
  UNLINK_ERROR: SERVER_ERROR
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code.
 */
function mapError(err) {
  console.error(err);
  return err.isDomain
    ? { status: (ERROR_MAP[err.errorCode] || BAD_REQUEST),
	code: err.errorCode,
	message: err.message
      }
    : { status: SERVER_ERROR,
	code: 'INTERNAL',
	message: err.toString()
      };
} 

/** Return URL (including host and port) for HTTP request req.
 *  Useful for producing Location headers.
 */
function requestUrl(req) {
  const port = req.app.locals.port;
  const url = req.originalUrl.replace(/\/$/, '');
  return `${req.protocol}://${req.hostname}:${port}${url}`;
}
  
