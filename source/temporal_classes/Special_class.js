/***********************************************************
Defines the Special class (an inflection)
***********************************************************/

// constructor function
function Special( sourceXMLnode ) {

    // invoke the constructor of my "ancestor" class, then call it using
    // values (passed in as arguments, or typical for my class)
    this.base = GenericTemporalObject;
    this.base('Special', sourceXMLnode);

    // No source provided, so this must be a new object; set default values instead

    // define core properties
    this.name = this.ID;
    this.description = "";

    // provide for a weighted "label"
    this.labelIndex = null;		// normally an integer, from 0 to 9
    this.labelStrength = null;	// how strong is this association?

    // keep a pointer to my target (Point, Event, or null)
    this.target = null;

    // Now bind to class-specific methods, defined below
    this.getProperty = _special_getProperty;
    this.setProperty = _special_setProperty;

    // methods for handling inflections on this Instant
    // TODO: AddTarget, EditTarget, DeleteTarget?
/// this.EditInflection = _instant_EditInflection;
    this.AddTarget = _special_AddTarget;
    this.RemoveTarget = _special_RemoveTarget;
    
    return this;
}

function _special_getProperty( strPropName ) {
    // Simply return the value of the specified property
    return this[strPropName];	// returns null if the property doesn't exist
}

/* TODO: Clean up unused properties!  */
function _special_setProperty(strPropName, suggestedValue) {
    // Attempt to set the specified property, return the new-or-unchanged value;
    // report any errors (bad values, etc.) to standard output

//baseUnit, precision, markedInterval, startTime, endTime

    // TODO: Add 'position' test (should be a valid Number)

    if ((strPropName == 'displayX') || (strPropName == 'displayY')) {
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

    } else if (strPropName == 'baseUnit') {
		var strSuggestedValue = suggestedValue + "";	// make sure it's a string
		// should be one of our approved base units
        arrAllowedUnits = new Array('seconds', 'days','months', 'years', 'centuries');
		var isAllowed = false;
		// buzz through the list, see if it's there
		for (var i = 0; i < arrAllowedUnits.length; i++) {
		    var testUnit = arrAllowedUnits[i];
		    if (testUnit == strSuggestedValue) {	// found a match!
				isAllowed = true;
		    }
		}
		if (isAllowed) {
		    // it's in the list, so let's allow it
		    this.baseUnit = strSuggestedValue;
		    return this.baseUnit;
		} else {
		    // new value is not in our list, return an error
		    return "ERROR: '" + strSuggestedValue + "' is not an allowed base unit!";
		}

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

function _special_AddTarget( ) {
}


function _special_RemoveTarget( ) {
}


trace("Special_class loaded successfully");
