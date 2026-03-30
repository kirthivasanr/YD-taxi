(function () {
  const config = {
    businessName: "YD TAXI",
    baseCity: "Chennai",
    siteUrl: "",
    whatsappNumber: "919080609081",
    phoneNumber: "+919080609081",
    contactEmail: "support@ydtaxi.example",
    googleMapsApiKey: "",
    enableMapsAutocomplete: false,
    ...(window.YD_TAXI_CONFIG || {})
  };

  const rates = {
    oneway: { sedan: 14, etios: 14, suv: 19, innova: 20, minKm: 130 },
    round: { sedan: 13, etios: 13, suv: 18, innova: 19, minKm: 250 }
  };

  const cabCapacities = {
    sedan: 4,
    etios: 4,
    suv: 5,
    innova: 8
  };

  const driverBata = 400;
  const rateLimitRules = {
    suggestionLookup: {
      key: "yd_taxi_rate_suggestion_lookup",
      max: 90,
      windowMs: 60 * 1000,
      cooldownMs: 250,
      cooldownMessage: "Please pause briefly before searching again.",
      limitMessage: "Address suggestions are temporarily paused. Please wait about a minute and try again."
    },
    routeLookup: {
      key: "yd_taxi_rate_route_lookup",
      max: 8,
      windowMs: 60 * 1000,
      cooldownMs: 2500,
      cooldownMessage: "Please wait a moment before checking another route distance.",
      limitMessage: "Too many distance checks in a short time. Please wait about a minute and try again."
    },
    estimateAction: {
      key: "yd_taxi_rate_estimate_action",
      max: 10,
      windowMs: 60 * 1000,
      cooldownMs: 1200,
      cooldownMessage: "Please wait a moment before recalculating the fare.",
      limitMessage: "Fare checks are temporarily paused. Please wait about a minute and try again."
    },
    bookingAction: {
      key: "yd_taxi_rate_booking_action",
      max: 4,
      windowMs: 60 * 1000,
      cooldownMs: 5000,
      cooldownMessage: "Please wait a few seconds before sending another booking.",
      limitMessage: "Too many booking sends in a short time. Please wait about a minute and try again."
    }
  };

  const state = {
    tripType: "oneway",
    estimate: null,
    pickupPlace: null,
    dropPlace: null,
    placesLibrary: null,
    routesLibrary: null,
    sessionToken: null,
    autocompleteBound: false,
    predictionTimers: {
      pickup: null,
      drop: null
    },
    predictionRequestIds: {
      pickup: 0,
      drop: 0
    },
    mapsReady: false,
    mapsRequested: false,
    memoryRateLimits: {}
  };

  const form = document.getElementById("bookingForm");
  const fareSummary = document.getElementById("fareSummary");
  const statusBanner = document.getElementById("statusBanner");
  const mapsStatus = document.getElementById("mapsStatus");
  const distanceHelp = document.getElementById("distanceHelp");
  const cabCapacityText = document.getElementById("cabCapacityText");
  const tripButtons = Array.from(document.querySelectorAll("[data-trip]"));
  const tripFields = Array.from(document.querySelectorAll("[data-trip-mode]"));
  const nav = document.getElementById("site-nav");
  const menuToggle = document.querySelector(".menu-toggle");

  const fields = {
    pickup: document.getElementById("pickup"),
    drop: document.getElementById("drop"),
    distance: document.getElementById("distance"),
    cabType: document.getElementById("cabType"),
    date: document.getElementById("date"),
    time: document.getElementById("time"),
    startDate: document.getElementById("startDate"),
    startTime: document.getElementById("startTime"),
    returnDate: document.getElementById("returnDate"),
    returnTime: document.getElementById("returnTime"),
    name: document.getElementById("name"),
    countryCode: document.getElementById("countryCode"),
    mobile: document.getElementById("mobile"),
    passengers: document.getElementById("passengers"),
    luggage: document.getElementById("luggage"),
    notes: document.getElementById("notes")
  };
  const suggestionLists = {
    pickup: document.getElementById("pickupSuggestions"),
    drop: document.getElementById("dropSuggestions")
  };

  function init() {
    applyContactConfig();
    setMinDates();
    setTripMode("oneway");
    updateCabCapacity();
    bindEvents();
    initReveal();
    initSectionObserver();
    maybeLoadGoogleMaps();
  }

  function applyContactConfig() {
    const phoneDisplay = config.phoneNumber || `+${config.whatsappNumber}`;
    const whatsappLink = `https://wa.me/${cleanNumber(config.whatsappNumber)}?text=${encodeURIComponent(`Hi ${config.businessName}, I would like to book a ride.`)}`;

    document.title = `${config.businessName} | ${config.baseCity} Intercity Taxi Booking`;

    document.querySelectorAll("[data-phone-link]").forEach((node) => {
      node.href = `tel:${phoneDisplay}`;
    });

    document.querySelectorAll("[data-phone-display]").forEach((node) => {
      node.textContent = formatDisplayPhone(phoneDisplay);
    });

    document.querySelectorAll("[data-whatsapp-link]").forEach((node) => {
      node.href = whatsappLink;
    });

    document.querySelectorAll("[data-email-link]").forEach((node) => {
      node.href = `mailto:${config.contactEmail}`;
    });

    document.querySelectorAll("[data-email-display]").forEach((node) => {
      node.textContent = config.contactEmail;
    });
  }

  function bindEvents() {
    tripButtons.forEach((button) => {
      button.addEventListener("click", function () {
        setTripMode(button.dataset.trip);
      });
    });

    menuToggle.addEventListener("click", function () {
      const isOpen = nav.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a[href^='#']").forEach((link) => {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest(".autocomplete-shell")) {
        closeSuggestionList("pickup");
        closeSuggestionList("drop");
      }
    });

    fields.cabType.addEventListener("change", function () {
      updateCabCapacity();
      invalidateEstimate();
    });

    fields.countryCode.addEventListener("change", invalidateEstimate);
    fields.passengers.addEventListener("input", enforcePassengerLimit);
    fields.startDate.addEventListener("change", syncReturnMinDate);

    Object.values(fields).forEach((field) => {
      field.addEventListener("input", function () {
        clearFieldError(field.id);
        invalidateEstimate();
      });
      field.addEventListener("change", function () {
        clearFieldError(field.id);
        invalidateEstimate();
      });
    });

    document.getElementById("estimateButton").addEventListener("click", function () {
      const estimateCheck = consumeRateLimit("estimateAction");
      if (!estimateCheck.allowed) {
        showStatus(estimateCheck.message, "error");
        return;
      }

      const result = calculateEstimate({ showErrors: true });
      if (result) {
        showStatus("Fare estimated successfully. Review the summary before sending to WhatsApp.", "success");
      }
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const bookingCheck = consumeRateLimit("bookingAction");
      if (!bookingCheck.allowed) {
        showStatus(bookingCheck.message, "error");
        return;
      }

      const result = calculateEstimate({ showErrors: true });
      if (!result) {
        showStatus("Please fix the form errors before sending the booking.", "error");
        return;
      }

      const bookingRef = result.bookingRef;
      const message = buildWhatsAppMessage(result);
      const url = `https://wa.me/${cleanNumber(config.whatsappNumber)}?text=${encodeURIComponent(message)}`;
      const popup = window.open(url, "_blank", "noopener,noreferrer");

      if (!popup) {
        window.location.href = url;
      }

      showStatus(`WhatsApp opened with booking reference ${bookingRef}.`, "success");
    });
  }

  function setTripMode(mode) {
    state.tripType = mode;
    tripButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.trip === mode);
    });

    tripFields.forEach((field) => {
      const isMatch = field.dataset.tripMode === mode;
      field.classList.toggle("is-hidden", !isMatch);
      const input = field.querySelector("input");
      if (input) {
        input.disabled = !isMatch;
      }
    });

    invalidateEstimate();
  }

  function setMinDates() {
    const iso = new Date().toISOString().split("T")[0];
    fields.date.min = iso;
    fields.startDate.min = iso;
    fields.returnDate.min = iso;
  }

  function syncReturnMinDate() {
    fields.returnDate.min = fields.startDate.value || fields.startDate.min;
    invalidateEstimate();
  }

  function updateCabCapacity() {
    const cabType = fields.cabType.value;
    const limit = cabCapacities[cabType] || 4;
    fields.passengers.max = String(limit);
    cabCapacityText.textContent = `Seats up to ${limit} passengers.`;

    if (fields.passengers.value && Number(fields.passengers.value) > limit) {
      fields.passengers.value = String(limit);
    }
  }

  function enforcePassengerLimit() {
    if (!fields.passengers.value) {
      return;
    }

    const limit = Number(fields.passengers.max);
    const value = Number(fields.passengers.value);
    if (Number.isNaN(value)) {
      return;
    }

    if (value < 1) {
      fields.passengers.value = "1";
    } else if (value > limit) {
      fields.passengers.value = String(limit);
    }
  }

  function maybeLoadGoogleMaps() {
    const key = String(config.googleMapsApiKey || "").trim();
    const enabled = Boolean(key && config.enableMapsAutocomplete !== false);

    if (!enabled) {
      mapsStatus.textContent = "Manual distance entry enabled";
      distanceHelp.textContent = "Enter the distance manually if route lookup is unavailable.";
      fields.distance.readOnly = false;
      return;
    }

    if (window.location.protocol === "file:") {
      mapsStatus.textContent = "Serve over localhost for suggestions";
      distanceHelp.textContent = "If suggestions do not appear, open the site through http://localhost, http://127.0.0.1, or your live domain because Google API keys usually block file:// pages.";
    }

    if (state.mapsRequested) {
      return;
    }

    state.mapsRequested = true;
    mapsStatus.textContent = "Loading Google Maps";
    const mapsLoadTimeout = window.setTimeout(function () {
      if (!state.mapsReady) {
        mapsStatus.textContent = "Check Google API settings";
        distanceHelp.textContent = "Make sure billing is enabled and that Maps JavaScript API, Places API, and Directions API (Legacy) are allowed for http://localhost, http://127.0.0.1, and your live domain.";
      }
    }, 7000);

    window.__ydTaxiInitMaps = async function () {
      window.clearTimeout(mapsLoadTimeout);
      state.mapsReady = true;
      await setupAutocomplete();
      if (state.placesLibrary) {
        mapsStatus.textContent = "Google suggestions ready";
        distanceHelp.textContent = "Distance is auto-calculated after you select both locations from the suggestions.";
      }
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&callback=__ydTaxiInitMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = function () {
      window.clearTimeout(mapsLoadTimeout);
      mapsStatus.textContent = "Maps failed to load";
      distanceHelp.textContent = "Route lookup is unavailable right now, so you can still enter the distance manually.";
      fields.distance.readOnly = false;
    };
    document.head.appendChild(script);
  }

  async function setupAutocomplete() {
    if (!window.google || !window.google.maps || typeof google.maps.importLibrary !== "function") {
      mapsStatus.textContent = "Maps unavailable";
      return;
    }

    try {
      state.placesLibrary = await google.maps.importLibrary("places");
      state.sessionToken = createSessionToken();
    } catch (error) {
      mapsStatus.textContent = "Places unavailable";
      distanceHelp.textContent = "Google place suggestions could not start. Check that Maps JavaScript API and Places API are enabled for this site URL.";
      fields.distance.readOnly = false;
      return;
    }

    if (state.autocompleteBound) {
      return;
    }

    state.autocompleteBound = true;

    ["pickup", "drop"].forEach(function (fieldName) {
      fields[fieldName].addEventListener("input", function () {
        resetSelectedPlace(fieldName);
        scheduleSuggestionLookup(fieldName);
      });

      fields[fieldName].addEventListener("focus", function () {
        if (fields[fieldName].value.trim().length >= 2) {
          scheduleSuggestionLookup(fieldName, { immediate: true });
        }
      });
    });
  }

  function scheduleSuggestionLookup(fieldName, options) {
    const immediate = options && options.immediate;
    const value = fields[fieldName].value.trim();

    window.clearTimeout(state.predictionTimers[fieldName]);

    if (!state.mapsReady || !state.placesLibrary || value.length < 2) {
      state.predictionRequestIds[fieldName] += 1;
      closeSuggestionList(fieldName);
      if (!value) {
        state.sessionToken = createSessionToken();
      }
      return;
    }

    const runLookup = function () {
      requestSuggestions(fieldName, value);
    };

    if (immediate) {
      runLookup();
      return;
    }

    state.predictionTimers[fieldName] = window.setTimeout(runLookup, 220);
  }

  async function requestSuggestions(fieldName, inputText) {
    const rateCheck = consumeRateLimit("suggestionLookup");
    if (!rateCheck.allowed) {
      renderSuggestionState(fieldName, rateCheck.message);
      return;
    }

    state.predictionRequestIds[fieldName] += 1;
    const requestId = state.predictionRequestIds[fieldName];

    try {
      const response = await state.placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: inputText,
        sessionToken: state.sessionToken || undefined,
        region: "in"
      });

      if (requestId !== state.predictionRequestIds[fieldName]) {
        return;
      }

      const predictions = Array.isArray(response && response.suggestions)
        ? response.suggestions
          .map(function (suggestion) {
            return suggestion && suggestion.placePrediction ? suggestion.placePrediction : null;
          })
          .filter(Boolean)
        : [];

      if (predictions.length === 0) {
        renderSuggestionState(fieldName, "No matching places found.");
        return;
      }

      renderSuggestions(fieldName, predictions);
    } catch (error) {
      if (requestId !== state.predictionRequestIds[fieldName]) {
        return;
      }

      mapsStatus.textContent = "Suggestions unavailable";
      distanceHelp.textContent = "Check that Maps JavaScript API and Places API are enabled for this site URL, then refresh the page.";
      renderSuggestionState(fieldName, "Suggestions are unavailable right now.");
    }
  }

  function renderSuggestions(fieldName, predictions) {
    const list = suggestionLists[fieldName];
    if (!list) {
      return;
    }

    closeSuggestionList(fieldName === "pickup" ? "drop" : "pickup");
    list.innerHTML = "";
    predictions.slice(0, 5).forEach(function (prediction) {
      const mainText = prediction.mainText && prediction.mainText.text
        ? prediction.mainText.text
        : prediction.text && prediction.text.text
          ? prediction.text.text
          : "";
      const secondaryText = prediction.secondaryText && prediction.secondaryText.text
        ? prediction.secondaryText.text
        : "";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "autocomplete-item";
      button.setAttribute("role", "option");
      button.innerHTML = `
        <span class="autocomplete-main">${escapeHtml(mainText)}</span>
        <span class="autocomplete-secondary">${escapeHtml(secondaryText || mainText)}</span>
      `;
      button.addEventListener("click", function () {
        selectPrediction(fieldName, prediction);
      });
      list.appendChild(button);
    });

    list.classList.add("is-open");
  }

  function renderSuggestionState(fieldName, message) {
    const list = suggestionLists[fieldName];
    if (!list) {
      return;
    }

    list.innerHTML = `<div class="autocomplete-empty">${escapeHtml(message)}</div>`;
    list.classList.add("is-open");
  }

  async function selectPrediction(fieldName, prediction) {
    state.predictionRequestIds[fieldName] += 1;
    closeSuggestionList(fieldName);
    mapsStatus.textContent = fieldName === "pickup" ? "Loading pickup details" : "Loading destination details";

    try {
      const place = await fetchPlaceDetails(prediction);
      const displayValue = place.formatted_address
        || (prediction.text && prediction.text.text)
        || fields[fieldName].value;

      fields[fieldName].value = displayValue;
      if (fieldName === "pickup") {
        state.pickupPlace = place;
        mapsStatus.textContent = "Pickup selected";
      } else {
        state.dropPlace = place;
        mapsStatus.textContent = "Destination selected";
      }

      clearFieldError(fieldName);
      state.sessionToken = createSessionToken();
      maybeCalculateDistanceFromMaps();
    } catch (error) {
      mapsStatus.textContent = "Place details unavailable";
      distanceHelp.textContent = "Suggestions loaded, but place details could not be completed. You can still type the distance manually.";
      fields.distance.readOnly = false;
    }
  }

  async function fetchPlaceDetails(prediction) {
    if (!prediction || typeof prediction.toPlace !== "function") {
      throw new Error("Place prediction unavailable");
    }

    const place = prediction.toPlace();
    await place.fetchFields({
      fields: ["displayName", "formattedAddress", "location"]
    });

    if (!place.location) {
      throw new Error("Missing place location");
    }

    return {
      geometry: { location: place.location },
      formatted_address: place.formattedAddress || (prediction.text && prediction.text.text) || "",
      name: place.displayName || (prediction.mainText && prediction.mainText.text) || (prediction.text && prediction.text.text) || ""
    };
  }

  function resetSelectedPlace(fieldName) {
    const hadRouteSelection = Boolean(state.pickupPlace || state.dropPlace);

    if (fieldName === "pickup") {
      state.pickupPlace = null;
    } else {
      state.dropPlace = null;
    }

    state.predictionRequestIds[fieldName] += 1;
    closeSuggestionList(fieldName);
    if (hadRouteSelection || !state.sessionToken) {
      state.sessionToken = createSessionToken();
    }
    if (hadRouteSelection) {
      fields.distance.value = "";
    }
    fields.distance.readOnly = false;
    if (state.mapsReady) {
      mapsStatus.textContent = "Search for a location";
      distanceHelp.textContent = "Choose a pickup and destination from the suggestions to auto-calculate distance.";
    }
    invalidateEstimate();
  }

  function closeSuggestionList(fieldName) {
    const list = suggestionLists[fieldName];
    if (!list) {
      return;
    }

    list.classList.remove("is-open");
    list.innerHTML = "";
  }

  async function maybeCalculateDistanceFromMaps() {
    if (!state.mapsReady || !state.pickupPlace || !state.dropPlace) {
      return;
    }

    const routeCheck = consumeRateLimit("routeLookup");
    if (!routeCheck.allowed) {
      mapsStatus.textContent = "Route lookup paused";
      distanceHelp.textContent = routeCheck.message;
      return;
    }

    try {
      if (!state.routesLibrary && window.google && window.google.maps && typeof google.maps.importLibrary === "function") {
        state.routesLibrary = await google.maps.importLibrary("routes");
      }
    } catch (error) {
      mapsStatus.textContent = "Distance lookup unavailable";
      distanceHelp.textContent = "Enable Directions API (Legacy) in the same Google Cloud project to auto-calculate distance.";
      fields.distance.readOnly = false;
      return;
    }

    const DirectionsServiceCtor = state.routesLibrary && typeof state.routesLibrary.DirectionsService === "function"
      ? state.routesLibrary.DirectionsService
      : google.maps.DirectionsService;
    const drivingMode = state.routesLibrary && state.routesLibrary.TravelMode
      ? state.routesLibrary.TravelMode.DRIVING
      : google.maps.TravelMode.DRIVING;

    if (typeof DirectionsServiceCtor !== "function") {
      mapsStatus.textContent = "Distance lookup unavailable";
      distanceHelp.textContent = "Directions service is not available for this API setup right now. You can still enter the distance manually.";
      fields.distance.readOnly = false;
      return;
    }

    try {
      const service = new DirectionsServiceCtor();
      const result = await service.route({
        origin: state.pickupPlace.geometry.location,
        destination: state.dropPlace.geometry.location,
        travelMode: drivingMode
      });

      if (!result.routes || !result.routes[0] || !result.routes[0].legs[0]) {
        throw new Error("Missing route leg");
      }

      const meters = result.routes[0].legs[0].distance.value;
      const kilometers = (meters / 1000).toFixed(1);
      fields.distance.value = kilometers;
      fields.distance.readOnly = true;
      mapsStatus.textContent = "Distance auto-calculated";
      distanceHelp.textContent = "Distance is auto-calculated after you select both locations from the suggestions.";
      clearFieldError("distance");
      invalidateEstimate();
    } catch (error) {
      mapsStatus.textContent = "Distance lookup failed";
      distanceHelp.textContent = "Auto-distance could not be completed for this route. Check Directions API (Legacy) and your key restrictions, or enter the distance manually.";
      fields.distance.readOnly = false;
    }
  }

  function calculateEstimate(options) {
    if (!validateForm(options.showErrors)) {
      state.estimate = null;
      renderEmptyFare();
      return null;
    }

    const bookingRef = buildBookingReference();
    const tripType = state.tripType;
    const cabType = fields.cabType.value;
    const distance = Number(fields.distance.value);
    const rateConfig = rates[tripType];
    const rate = rateConfig[cabType];

    let chargeableKm = distance;
    let minimumKm = rateConfig.minKm;
    let days = 1;
    let driverCharge = driverBata;

    if (tripType === "round") {
      days = getRoundTripDays(fields.startDate.value, fields.returnDate.value);
      minimumKm = rateConfig.minKm * days;
      chargeableKm = Math.max(distance, minimumKm);
      driverCharge = driverBata * days;
    } else {
      chargeableKm = Math.max(distance, minimumKm);
    }

    const fareAmount = chargeableKm * rate;
    const total = fareAmount + driverCharge;

    state.estimate = {
      bookingRef,
      tripType,
      cabType,
      distance,
      rate,
      chargeableKm,
      minimumKm,
      fareAmount,
      driverCharge,
      total,
      days,
      passengers: fields.passengers.value ? Number(fields.passengers.value) : null,
      luggage: fields.luggage.value || "Not specified",
      notes: fields.notes.value.trim() || "None",
      name: fields.name.value.trim(),
      mobile: `${fields.countryCode.value}${sanitizeDigits(fields.mobile.value)}`,
      pickup: fields.pickup.value.trim(),
      drop: fields.drop.value.trim(),
      date: fields.date.value,
      time: fields.time.value,
      startDate: fields.startDate.value,
      startTime: fields.startTime.value,
      returnDate: fields.returnDate.value,
      returnTime: fields.returnTime.value
    };

    renderFare(state.estimate);
    return state.estimate;
  }

  function validateForm(showErrors) {
    const errors = {};
    const cabType = fields.cabType.value;
    const passengerLimit = cabCapacities[cabType] || 4;
    const pickup = fields.pickup.value.trim();
    const drop = fields.drop.value.trim();
    const name = fields.name.value.trim();
    const mobileDigits = sanitizeDigits(fields.mobile.value);
    const distance = Number(fields.distance.value);

    if (!pickup) {
      errors.pickup = "Pickup location is required.";
    }

    if (!drop) {
      errors.drop = "Drop location is required.";
    }

    if (!Number.isFinite(distance) || distance <= 0) {
      errors.distance = "Distance must be greater than 0 km.";
    }

    if (!name || name.length < 2) {
      errors.name = "Enter a valid customer name.";
    }

    if (!mobileDigits) {
      errors.mobile = "Mobile number is required.";
    } else if (fields.countryCode.value === "+91" && !/^[6-9]\d{9}$/.test(mobileDigits)) {
      errors.mobile = "Enter a valid 10-digit Indian mobile number.";
    } else if (fields.countryCode.value !== "+91" && !/^\d{6,14}$/.test(mobileDigits)) {
      errors.mobile = "Enter a valid mobile number.";
    }

    if (fields.passengers.value) {
      const passengers = Number(fields.passengers.value);
      if (!Number.isInteger(passengers) || passengers < 1 || passengers > passengerLimit) {
        errors.passengers = `Passengers must be between 1 and ${passengerLimit} for ${cabType.toUpperCase()}.`;
      }
    }

    if (state.tripType === "oneway") {
      if (!fields.date.value) {
        errors.date = "Travel date is required.";
      }
      if (!fields.time.value) {
        errors.time = "Pickup time is required.";
      }
    } else {
      if (!fields.startDate.value) {
        errors.startDate = "Start date is required.";
      }
      if (!fields.startTime.value) {
        errors.startTime = "Start time is required.";
      }
      if (!fields.returnDate.value) {
        errors.returnDate = "Return date is required.";
      }
      if (!fields.returnTime.value) {
        errors.returnTime = "Return time is required.";
      }

      if (fields.startDate.value && fields.returnDate.value) {
        const start = new Date(`${fields.startDate.value}T${fields.startTime.value || "00:00"}`);
        const end = new Date(`${fields.returnDate.value}T${fields.returnTime.value || "00:00"}`);
        if (end < start) {
          errors.returnDate = "Return trip must be after the start trip.";
        }
      }
    }

    if (!showErrors) {
      return Object.keys(errors).length === 0;
    }

    Object.keys(fields).forEach(clearFieldError);
    Object.entries(errors).forEach(([fieldName, message]) => {
      setFieldError(fieldName, message);
    });

    return Object.keys(errors).length === 0;
  }

  function renderFare(estimate) {
    const tripLabel = estimate.tripType === "oneway" ? "One Way" : "Round Trip";
    const schedule = estimate.tripType === "oneway"
      ? `${estimate.date || "Date pending"} at ${estimate.time || "Time pending"}`
      : `${estimate.startDate || "Start date pending"} ${estimate.startTime || ""} to ${estimate.returnDate || "Return date pending"} ${estimate.returnTime || ""}`.trim();

    fareSummary.innerHTML = `
      <div class="fare-summary-top">
        <div>
          <p class="fare-title">${tripLabel} estimate</p>
          <p class="fare-note">${schedule}</p>
        </div>
        <span class="fare-reference">${estimate.bookingRef}</span>
      </div>
      <div class="fare-grid">
        <div class="fare-row"><span>Cab type</span><strong>${estimate.cabType.toUpperCase()}</strong></div>
        <div class="fare-row"><span>Actual distance</span><strong>${estimate.distance.toFixed(1)} km</strong></div>
        <div class="fare-row"><span>Chargeable distance</span><strong>${estimate.chargeableKm.toFixed(1)} km</strong></div>
        <div class="fare-row"><span>Minimum rule</span><strong>${estimate.minimumKm} km${estimate.tripType === "round" ? ` (${estimate.days} day${estimate.days > 1 ? "s" : ""})` : ""}</strong></div>
        <div class="fare-row"><span>Rate</span><strong>Rs ${estimate.rate}/km</strong></div>
        <div class="fare-row"><span>Fare amount</span><strong>Rs ${formatNumber(estimate.fareAmount)}</strong></div>
        <div class="fare-row"><span>Driver bata</span><strong>Rs ${formatNumber(estimate.driverCharge)}</strong></div>
        <div class="fare-row total"><span>Total estimate</span><strong>Rs ${formatNumber(estimate.total)}</strong></div>
      </div>
      <p class="fare-note">Toll, parking, and state tax are extra. The WhatsApp message will include this fare breakdown.</p>
    `;
  }

  function renderEmptyFare() {
    fareSummary.innerHTML = `
      <div class="fare-card-empty">
        <p class="fare-title">Fare estimate</p>
        <p>Your fare summary will appear here after validation.</p>
      </div>
    `;
  }

  function invalidateEstimate() {
    if (!state.estimate) {
      return;
    }

    state.estimate = null;
    renderEmptyFare();
  }

  function buildWhatsAppMessage(estimate) {
    const routeBlock = `Pickup: ${estimate.pickup}\nDrop: ${estimate.drop}`;
    const scheduleBlock = estimate.tripType === "oneway"
      ? `Date: ${estimate.date}\nTime: ${estimate.time}`
      : `Start: ${estimate.startDate} ${estimate.startTime}\nReturn: ${estimate.returnDate} ${estimate.returnTime}`;

    return [
      `${config.businessName} booking request`,
      "",
      `Booking ref: ${estimate.bookingRef}`,
      `Name: ${estimate.name}`,
      `Mobile: ${estimate.mobile}`,
      "",
      routeBlock,
      "",
      `Trip type: ${estimate.tripType === "oneway" ? "One Way" : "Round Trip"}`,
      scheduleBlock,
      `Cab type: ${estimate.cabType.toUpperCase()}`,
      `Passengers: ${estimate.passengers || "Not specified"}`,
      `Luggage: ${estimate.luggage}`,
      "",
      `Actual distance: ${estimate.distance.toFixed(1)} km`,
      `Chargeable distance: ${estimate.chargeableKm.toFixed(1)} km`,
      `Rate: Rs ${estimate.rate}/km`,
      `Fare amount: Rs ${formatNumber(estimate.fareAmount)}`,
      `Driver bata: Rs ${formatNumber(estimate.driverCharge)}`,
      `Estimated total: Rs ${formatNumber(estimate.total)}`,
      "",
      `Notes: ${estimate.notes}`
    ].join("\n");
  }

  function buildBookingReference() {
    return `YD-${Date.now().toString(36).toUpperCase()}`;
  }

  function consumeRateLimit(name, options) {
    const settings = rateLimitRules[name];
    const silent = options && options.silent;

    if (!settings) {
      return { allowed: true, message: "" };
    }

    const now = Date.now();
    const record = loadRateLimitRecord(settings.key);
    const timestamps = record.timestamps.filter((timestamp) => now - timestamp < settings.windowMs);
    const lastAt = record.lastAt || 0;

    if (settings.cooldownMs && now - lastAt < settings.cooldownMs) {
      const waitSeconds = Math.ceil((settings.cooldownMs - (now - lastAt)) / 1000);
      const message = `${settings.cooldownMessage} Try again in ${waitSeconds}s.`;
      if (!silent) {
        saveRateLimitRecord(settings.key, { timestamps, lastAt });
      }
      return { allowed: false, message };
    }

    if (timestamps.length >= settings.max) {
      const oldest = timestamps[0];
      const waitSeconds = Math.ceil((settings.windowMs - (now - oldest)) / 1000);
      const message = `${settings.limitMessage} Try again in ${waitSeconds}s.`;
      if (!silent) {
        saveRateLimitRecord(settings.key, { timestamps, lastAt });
      }
      return { allowed: false, message };
    }

    timestamps.push(now);
    saveRateLimitRecord(settings.key, { timestamps, lastAt: now });
    return { allowed: true, message: "" };
  }

  function loadRateLimitRecord(storageKey) {
    const fallback = state.memoryRateLimits[storageKey] || { timestamps: [], lastAt: 0 };

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return fallback;
      }

      const parsed = JSON.parse(raw);
      return {
        timestamps: Array.isArray(parsed.timestamps) ? parsed.timestamps : [],
        lastAt: Number(parsed.lastAt) || 0
      };
    } catch (error) {
      return fallback;
    }
  }

  function saveRateLimitRecord(storageKey, record) {
    state.memoryRateLimits[storageKey] = record;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(record));
    } catch (error) {
      // Ignore localStorage failures and keep the in-memory fallback.
    }
  }

  function showStatus(message, type) {
    statusBanner.textContent = message;
    statusBanner.className = `status-banner is-visible ${type === "success" ? "is-success" : "is-error"}`;
  }

  function setFieldError(fieldName, message) {
    const field = fields[fieldName];
    if (field) {
      field.classList.add("is-invalid");
    }

    const errorNode = document.querySelector(`[data-error-for="${fieldName}"]`);
    if (errorNode) {
      errorNode.textContent = message;
    }
  }

  function clearFieldError(fieldName) {
    const field = fields[fieldName];
    if (field) {
      field.classList.remove("is-invalid");
    }

    const errorNode = document.querySelector(`[data-error-for="${fieldName}"]`);
    if (errorNode) {
      errorNode.textContent = "";
    }
  }

  function getRoundTripDays(startDate, returnDate) {
    const start = new Date(startDate);
    const end = new Date(returnDate);
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  }

  function formatNumber(value) {
    return Number(value).toLocaleString("en-IN", {
      maximumFractionDigits: 0
    });
  }

  function sanitizeDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function cleanNumber(value) {
    return String(value || "").replace(/[^\d]/g, "");
  }

  function formatDisplayPhone(value) {
    const digits = cleanNumber(value);
    if (digits.startsWith("91") && digits.length === 12) {
      return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    }
    return value;
  }

  function createSessionToken() {
    if (state.placesLibrary && typeof state.placesLibrary.AutocompleteSessionToken === "function") {
      return new state.placesLibrary.AutocompleteSessionToken();
    }

    return null;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initReveal() {
    const revealNodes = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );

    revealNodes.forEach(function (node) {
      observer.observe(node);
    });
  }

  function initSectionObserver() {
    const sections = ["booking", "fleet", "pricing", "routes", "faq", "contact"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const navLinks = Array.from(nav.querySelectorAll("a[href^='#']"));
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }

          navLinks.forEach(function (link) {
            link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
          });
        });
      },
      { threshold: 0.45 }
    );

    sections.forEach((section) => {
      observer.observe(section);
    });
  }

  renderEmptyFare();
  init();
})();
