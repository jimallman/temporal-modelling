/***********************************************************
Defines the Causality class (an inflection)
***********************************************************/

// constructor function
function Causality( sourceXMLnode ) {

    // invoke the constructor of my "ancestor" class, then call it using
    // values (passed in as arguments, or typical for my class)
    this.base = GenericTemporalObject;
    this.base('Causality', sourceXMLnode);

    // No source provided, so this must be a new object; set default values instead

    // define core properties
    this.name = this.ID;
    this.description = "";

    // provide for a weighted "label"
    this.labelIndex = null;		// normally an integer, from 0 to 9
    this.labelStrength = null;	// how strong is this association?

    // keep pointers to my source (cause) and target (effect) objects
    this.source = null;
    this.target = null;

    // Now bind to class-specific methods, defined below
    this.getProperty = _special_getProperty;
    this.setProperty = _special_setProperty;

    // methods for managing linked objects?
    // TODO: AddTarget, EditTarget, DeleteTarget, etc?
    ///this.RemoveTarget = _special_RemoveTarget;
    
    return this;
}

function _special_getProperty( strPropName ) {
    // Simply return the value of the specified property
    return this[strPropName];	// returns null if the property doesn't exist
}

/* TODO: Clean up unused properties!  */
function _causality_setProperty(strPropName, suggestedValue) {
    // Attempt to set the specified property, return the new-or-unchanged value;
    // report any errors (bad values, etc.) to standard output

    if (strPropName == 'description') {
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


trace("Causality_class loaded successfully");
