/***********************************************************
Defines the Interval class
***********************************************************/

/* TODO:
    - Different Axis (timeline) shapes (curved, spiral, "weighted" with bumps) should
	be possible in Flash MX; can we conform to the shape of my parent Axis?
*/

// constructor function
function Interval( sourceXMLnode ) {
    // Has data been provided? 'sourceXMLDOM' is a live (parsed) XML tree, or text?

    // invoke the constructor of my "ancestor" class, then call it using
    // values (passed in as arguments, or typical for my class)
    this.base = GenericTemporalObject;
    this.base('Interval', sourceXMLnode);

	// No source provided, so this must be a new object; set default values instead

	// define core properties
	this.name = this.ID;
	this.description = "";

	// provide for a weighted "label"
	this.labelIndex = null;		// normally an integer, from 0 to 9
	this.labelStrength = null;	// how strong is this association?

	// keep a pointer to my parent Model (or other object?)
	this.parent = null;

	// keep an array of pointers to my children (?)
	this.children = new Array();
	this.inflections = new Array();

	// establish basic metrics for this Axis (its units, precision, etc.)
	this.boundedEnds = "both";	// can be "start", "end", "neither", or "both"

	// display characteristics
	this.markedInterval = 10; 	// shows a hash-mark every n baseUnits (or none, if 0)
	this.displayX = 0.5;		// horizontal display position, from 0.0 to 1.0 (left to right)
	this.displayY = 0.5;		// vertical display position, from 0.0 to 1.0 (top to bottom)
	this.displayLength = 0.25;	// length of this axis relative to standard display size
	// define starting and ending times (for display purposes); these can be adjusted manually,
	// or "pushed" by child objects which are outside of these boundaries
	this.startTime = null;		// are these Javascript Date objects?
	this.endTime = null;

    // Now bind to class-specific methods, defined below
    this.getProperty = _interval_getProperty;
    this.setProperty = _interval_setProperty;

    // more interesting methods here?

    return this;
}

function _interval_getProperty( strPropName ) {
    // Simply return the value of the specified property
    return this[strPropName];	// returns null if the property doesn't exist
}

function _interval_setProperty(strPropName, suggestedValue) {
    // Attempt to set the specified property, return the new-or-unchanged value;
    // report any errors (bad values, etc.) to standard output

//baseUnit, precision, markedInterval, startTime, endTime

    if ((strPropName == 'position') || (strPropName == 'magnitude') || (strPropName == 'displayX') || (strPropName == 'displayY')) {
        // Convert suggestedValue to a floating point number, compare to 0.0 and 1.0,
        // enforce boundaries if needed, return the new value
	suggestedValue = suggestedValue + 0.0;
	if (suggestedValue < 0.0) {
	    suggestedValue = 0.0;
        } else if (suggestedValue > 1.0) {
	    suggestedValue = 1.0;
        }
	this[ strPropName ] = suggestedValue;
	// TODO: Format this properly, as a decimal number with two places to the right of the dot
        return this[ strPropName ];
    } else if (strPropName == 'description') {
	// clearing the description is OK
        var strSuggestedValue = suggestedValue + "";
	this.description = strSuggestedValue;
	return this.description;
    } else if (strPropName == 'name') {
        var strSuggestedValue = suggestedValue + "";
	if (strSuggestedValue.length > 0) {
	    this.name = strSuggestedValue;
        } else {
            // TODO: Can't make a visible string from this value! report an error
            return "ERROR: Name cannot be empty!";
        }
        return this.name;
    } else if (strPropName == 'ID') {
	// TODO: This is a read-only property; post an error and return its current value
        return this[ strPropName ];
    } else if (strPropName == 'labelIndex') {
		// make sure it's an integer from 0 to 9, or null
		var isAllowed = false;
		if (suggestedValue == null) {	// remove the currently assigned label
			isAllowed = true;
		} else if ((typeof(suggestedValue) == 'number') &&
					 (suggestedValue >= 0) &&
					 (suggestedValue <= 9)) {
			isAllowed = true;
		}
		if (isAllowed) {
		    this.labelIndex = suggestedValue;
		    return this.labelIndex;
		} else {
		    // new value is not in our list, return an error
		    return "ERROR: '" + suggestedValue + "' is not an allowed value for labelIndex!";
		}

    } else if (strPropName == 'labelStrength') {
		if (suggestedValue == null) {	// remove the currently assigned label-strength
		    this.labelStrength = null;
		    return this.labelStrength;
		} else {
			var strSuggestedValue = suggestedValue + "";	// make sure it's a string
			// should be one of our approved base units
	        var arrAllowedValues = new Array( 'low', 'medium', 'high' );
			var isAllowed = false;
			// buzz through the list, see if it's there
			for (var i = 0; i < arrAllowedValues.length; i++) {
			    var testValue = arrAllowedValues[i];
			    if (testValue == strSuggestedValue) {	// found a match!
					isAllowed = true;
			    }
			}
			if (isAllowed) {
			    // it's in the list, so let's allow it
			    this.labelStrength = strSuggestedValue;
			    return this.labelStrength;
			} else {
			    // new value is not in our list, return an error
			    return "ERROR: '" + strSuggestedValue + "' is not an allowed label strength!";
			}
		}
    } else {	// not an expected property
        return "ERROR: Property not found!";
    }
}

trace("Interval_class loaded successfully");
