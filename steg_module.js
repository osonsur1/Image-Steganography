#!/usr/bin/env nodejs

'use strict';

const Ppm = require('./ppm');

/** prefix which always precedes actual message when message is hidden
 *  in an image.
 */
const STEG_MAGIC = 'stg';
const STEG_TOO_BIG = "Msg too big!!!"
const STEG_BAD_MAGIC1 = "image already contains a hidden message"
const STEG_BAD_MAGIC2 = "image does not have a message"
const STEG_BAD_MSG = "Bad message!!!"

/** Constructor which takes some kind of ID and a Ppm image */
function StegModule(id, ppm) {
  this.id = id;
  this.ppm = ppm;
}

/** Hide message msg using PPM image contained in this StegModule object
 *  and return an object containing the new PPM image.
 *
 *  Specifically, this function will always return an object.  If an
 *  error occurs, then the "error" property of the return'd object
 *  will be set to a suitable error message.  If everything ok, then
 *  the "ppm" property of return'd object will be set to a Ppm image
 *  ppmOut which is derived from this.ppm with msg hidden.
 *
 *  The ppmOut image will be formed from the image contained in this
 *  StegModule object and msg as follows.
 *
 *    1.  The meta-info (header, comments, resolution, color-depth)
 *        for ppmOut is set to that of the PPM image contained in this
 *        StegModule object.
 *
 *    2.  A magicMsg is formed as the concatenation of STEG_MAGIC,
 *        msg and the NUL-character '\0'.
 *
 *    3.  The bits of the character codes of magicMsg including the
 *        terminating NUL-character are unpacked (MSB-first) into the
 *        LSB of successive pixel bytes of the ppmOut image.  Note
 *        that the pixel bytes of ppmOut should be identical to those
 *        of the image in this StegModule object except that the LSB of each
 *        pixel byte will contain the bits of magicMsg.
 *
 *  The function should detect the following errors:
 *
 *    STEG_TOO_BIG:   The provided pixelBytes array is not large enough
 *                    to allow hiding magicMsg.
 *    STEG_BAD_MAGIC: The image contained in this StegModule object may already
 *                    contain a hidden message; detected by seeing
 *                    this StegModule object's underlying image pixel bytes
 *                    starting with a hidden STEG_MAGIC string.
 *
 */
StegModule.prototype.hide = function(msg) {

  //check bad magic
  	var hiddenMsg = this.unhide();
  	if(hiddenMsg.hasOwnProperty("msg"))
  		return {error: this.id + ": " + STEG_BAD_MAGIC1}

  //TODO: hide STEG_MAGIC + msg + '\0' into a copy of this.ppm
  // Concatenate msg with prefix 'stg' and suffix '\0'

  msg = STEG_MAGIC + msg + "\0";

  var ppmClone = new Ppm(this.ppm);
  
	var byteIndex = 0;

	for (var msgIndex = 0; msgIndex < msg.length; msgIndex++) {
		var binaryMsg = ("00000000" + msg[msgIndex].charCodeAt().toString(2)).slice(-8);
		
		for (var binaryIndex = 0; binaryIndex < binaryMsg.length; binaryIndex++) {
			
			// check too big
			if(byteIndex > ppmClone.pixelBytes.length)
				return {error: this.id + ": " + STEG_TOO_BIG}

			if (binaryMsg[binaryIndex] == 1) 
				ppmClone.pixelBytes[byteIndex++] |= 1;
			else
				ppmClone.pixelBytes[byteIndex++] &= ~1;
		}
	};  
 
  //construct copy as shown below, then update pixelBytes in the copy.
  return { ppm: ppmClone};
}

/** Return message hidden in this StegModule object.  Specifically, if
 *  an error occurs, then return an object with "error" property set
 *  to a string describing the error.  If everything is ok, then the
 *  return'd object should have a "msg" property set to the hidden
 *  message.  Note that the return'd message should not contain
 *  STEG_MAGIC or the terminating NUL '\0' character.
 *
 *  The function will detect the following errors:
 *
 *    STEG_BAD_MAGIC: The image contained in this Steg object does not
 *                    contain a hidden message; detected by not
 *                    seeing this Steg object's underlying image pixel
 *                    bytes starting with a hidden STEG_MAGIC
 *                    string.
 *    STEG_BAD_MSG:   A bad message was decoded (the NUL-terminator
 *                    was not found).
 */
StegModule.prototype.unhide = function() {

  // Current Implementation is incomplete, as it assumes that the encoded msg in the file
  // starts from the first byte which may not be true.
  // Additionally error conditions 'STEG_BAD_MAGIC' and 'STEG_BAD_MSG' have not been handled yet

  var binaryMsg = 0
  var encodedMsg = ''
  var nullFlag = true;	// To check if message ends with '\0'


  for (var byteIndex = 0, len = this.ppm.pixelBytes.length; byteIndex < len; byteIndex++) {
    // Iterate through each byte and collect its Least Significant Bit(LSB)
    var byte = this.ppm.pixelBytes[byteIndex]

    // Check if Least Singnificant Bit(LSB) of the current byte is '1'
    // If it is '1', the set '1' in the correct position inside 'binaryMsg'
    // We group data bytes into groups of 8,
    // '(byteIndex % 8)' gives the index of the current byte inside this group
    // Subtracting '(byteIndex % 8)' from '8-1' gives us position in 'binaryMsg'
    // that should be set '1' if LSB of Current byte is '1'
    // We do that by creating a mask using '<<' operator and
    // using '|' operator we set the required but in 'binaryMsg'

    if (byte & 1)
      binaryMsg |= 1 << ((8-1) - (byteIndex % 8))

    if(byteIndex % 8 == 7){
      // After processing each set of '8' bytes,
      // 'binaryMsg' variable will have collected corresponding '8' LSBs from those bytes
      // Thus 'binaryMsg' will contain the binary representation of an ASCII code
      // Convert this ASCII code into string to get the encodedMsg character
     
      // If the 'binaryMsg' contains '0' indicating '\0' char, we know it is the end of msg
      if(binaryMsg == 0) {    // '\0' char found indicating end of message
      	nullFlag = false;		
        break 
      }

      // Converting 'binaryMsg' to char
      encodedMsg += String.fromCharCode(binaryMsg)
      // Reset 'binaryMsg' to '0' as processing of a group of '8' bytes is completed.
      binaryMsg = 0;
    }
  };

  // check bad message
  if (nullFlag)
  	return {error: this.id + ": " + STEG_BAD_MSG}

  // check bad magic
  if(encodedMsg.substring(0, STEG_MAGIC.length) != STEG_MAGIC)
  	return {error: this.id + ": " + STEG_BAD_MAGIC2}

  // Removes STEG_MAGIC header from the encoded string
  encodedMsg = encodedMsg.slice(STEG_MAGIC.length);



  return { msg: encodedMsg};
}


module.exports = StegModule;
