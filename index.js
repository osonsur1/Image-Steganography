#!/usr/bin/env nodejs

'use strict';
let wsURL;
const express = require('express');
const mustache = require('mustache');
const axios = require('axios');
const multer = require('multer');
const bodyParser = require('body-parser');
const upload = multer();
// const assert = require('assert');
// const path = require('path');
// const process = require('process');

// const services = require('../steg-ws');
// const imgStore = require('img-store');

function usage() {
  console.error(`usage: ${process.argv[1]} PORT WS-URL`);
  process.exit(1);
}

function getPort(portArg) {
  let port = Number(portArg);
  if (!port) usage();
  return port;
}

const BASE = '';

async function go(args) {
  try {
    const port = getPort(args[0]);
    wsURL = args[1];
    // const images = await imgStore();
    // await preloadImages(images, args.slice(1));
    serve(port, BASE);
  }
  catch (err) {
    console.error(err);
  }
}

function serve(port, base) {
  const app = express();
  app.locals.port = port;
  app.locals.base = base;
  // app.locals.images = images;
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

function setupRoutes(app){
  const base = app.locals.base;
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
  })); 

  app.get(`${base}/index`,homePage(app));
  app.get(`${base}/hide`,hidePage(app));
  app.post(`${base}/hide`,upload.single('inputTextFile'),hideMsg(app));
  app.get(`${base}/unhide`,unhidePage(app));
  app.post(`${base}/unhide`,unhideMsg(app));
}

function homePage(app){
  const base = app.locals.base

  return async function(req,res){
    let htmlOutput = `
    <html>
      <body> 
        <h1><a href="/hide">Hide Page</a></h1>
        <h1><a href="/unhide">UnHide Page</a></h1>
      </body>
    </html>`
    res.status(200).send(htmlOutput);
  }
}

function hidePage(app,options,errors){
  return async function(req,res){
    let htmlTemplate = `
    <html>
      <style>
        #wrapper{
          width: 1000px;
          margin: auto;
        }

        .holder img{  
          object-fit: contain;
          width: 100px;
        }
      </style>
      <body>
          {{#error}}
          <h2 style="color:red">{{errorMsg}}</h2>
          {{/error}}
          <form action="/hide" method="POST" enctype="multipart/form-data" >
              <div id="wrapper">
                  {{#imgList}}
                  <div class="holder">
                      <img src= "${wsURL}/api/images/inputs/{{imgName}}.png"/>
                      <input type="radio" name="img" value="{{imgName}}" {{{selected}}}/>
                      <span>{{imgName}}</span>
                      </br></br></br>
                  </div>
                  {{/imgList}}
                  </br></br></br>
                  <span>Enter Msg to Hide</span>
                  {{#defaults}}
                  <input type="text" name="inputTextBox" id="inputTextBox" {{{inputTextBox}}}/>
                  </br></br><span>Select File to Hide</span>
                  <input type="file" name="inputTextFile" id="inputTextFile" {{{inputTextFile}}}/>
                  {{/defaults}}
                  <input type="submit" id="submitButton"/>
              </div>
          </form>
      </body>
    </html>`

    let imgListingURL = wsURL + '/api/images/inputs'
    try{
      let result = await axios.get(imgListingURL,{timeout: 5000});
      let imgList = []
      result.data.forEach(function(element){
        let imgElement = {};
        imgElement.imgName = element;

        if(options != null && options.img != null && options.img == element)
          imgElement.selected = `checked="checked"`;

        imgList.push(imgElement);
        
      })
     
      let defaults = {}
      
      if(options != null && options.inputTextBox != null)
        defaults.inputTextBox = `value="${options.inputTextBox}"`;

      if(options != null && options.inputTextFile != null)
        defaults.inputTextFile = `value="${options.inputTextFile}"`;

      let data = {} 

      data.defaults = defaults;
      data.imgList = imgList;
      if(!!errors)
          data.error = errors;
      
      let htmlOutput = mustache.to_html(htmlTemplate,data);
      res.status(200).send(htmlOutput);
    }catch(err){
      switch(err.code){
        case "ECONNREFUSED":
          res.status(500).send(`Auxiliary service URL not found</br>${wsURL}`);
          break;
      }
    }

  }
}

function hideMsg(app){
  return async function(req,res){

    if(!req.body.img){
      //TODO: Img not selected
      let options = {}
      if(!!req.file) options.inputTextFile = req.file.originalname;
      if(!!req.body.inputTextBox) options.inputTextBox = req.body.inputTextBox;

      await hidePage(app,options,{errorMsg:"Img not selected"})(req,res)
      return
    }

    if(!req.file && !req.body.inputTextBox){
      //TODO: Input msg to hide or select file
      let options = {}
      if(!!req.body.img) options.img = req.body.img;

      await hidePage(app,options,{errorMsg:"Enter msg or select file to hide"})(req,res)
      return
    }

    let fileName = req.body.img;
    let hideMsgURL = wsURL + '/api/steg/inputs/' + fileName
    let postData = {};
    postData.outGroup = 'steg';
    if(!req.file){
      postData.msg = req.body.inputTextBox;
    }else{
      postData.msg = req.file.buffer.toString();
    }
    try{
      let result = await axios.post(hideMsgURL,postData);
    
      let outputFileName = result.headers.location;
      outputFileName = outputFileName.slice(outputFileName.lastIndexOf("/")+1);
      let htmlOutput = `
      <html>
        <body> 
          <h1>Msg successfully hidden in the selected image</br>New Image Name: ${outputFileName}</h1>
          <h3><a href="/hide">Hide Page</a></h3>
          <h3><a href="/unhide">UnHide Page</a></h3>
        </body>
      </html>`
      res.status(200).send(htmlOutput);
    }catch(err){
        let options = {}
        if(!!req.body.img) options.img = req.body.img;
        if(!!req.body.inputTextBox) options.inputTextBox = req.body.inputTextBox;
        if(!!req.body.inputTextFile) options.inputTextBox = req.body.inputTextFile;
      
      switch(err.response.status){
        case 413:
          await hidePage(app,options,{errorMsg:"Message to be hidden is too large!!!"})(req,res)
          break;
        case 404:
          await hidePage(app,options,{errorMsg:"Selected Image not found"})(req,res)
          break;
      }
    }
  }
}

function unhidePage(app,errors){
  return async function(req,res){
    let htmlTemplate = `
    <html>
      <style>
        #wrapper{
          width: 1000px;
          margin: auto;
        }

        .holder img{  
          object-fit: contain;
          width: 100px;
        }
      </style>
      <body>
          {{#error}}
          <h2 style="color:red">{{errorMsg}}</h2>
          {{/error}}
          <form action="/unhide" method="POST">
              <div id="wrapper">
                  {{#imgList}}
                  <div class="holder">
                      <img src= "${wsURL}/api/images/steg/{{imgName}}.png"/>
                      <input type="radio" name="img" value="{{imgName}}"/>
                      <span>{{imgName}}</span>
                      </br></br></br>
                  </div>
                  {{/imgList}}
                  </br></br></br>
                  
                  <input type="submit" id="submitButton" value="Unhide Msg"/>
              </div>
          </form>
      </body>
    </html>`

    let imgListingURL = wsURL + '/api/images/steg'
    try{
      let result = await axios.get(imgListingURL);
      let imgList = []
      result.data.forEach(function(element){imgList.push({imgName: element});})

      let data = {} 
      data.imgList = imgList;
      if(!!errors)
          data.error = errors;
      
      let htmlOutput = mustache.to_html(htmlTemplate,data);
      res.status(200).send(htmlOutput);
    }catch(err){
      switch(err.code){
        case "ECONNREFUSED":
          res.status(500).send(`Auxiliary service URL not found</br>${wsURL}`);
          break;
      }
    }
  }
}


function unhideMsg(app){
  return async function(req,res){

    if(!req.body.img){
      //TODO: Img not selected
      await unhidePage(app,{errorMsg:"Img not selected"})(req,res)
      return
    }

    let imgName = req.body.img;
    let hideMsgURL = wsURL + '/api/steg/steg/' + imgName
    try{
      let result = await axios.get(hideMsgURL);
      let htmlOutput = `
        <html>
          <body> 
            <h1>Recovedred Msg: ${result.data.msg}</h1>
            <h3><a href="/hide">Hide Page</a></h3>
            <h3><a href="/unhide">UnHide Page</a></h3>
          </body>
        </html>`
        res.status(200).send(htmlOutput);
    }catch(err){
      switch(err.response.status){
        case 404:
          await unhidePage(app,{errorMsg:"Selected Image not found"})(req,res)
          break;
      }
    }
  }
}

if (process.argv.length < 3) usage();
go(process.argv.slice(2));
