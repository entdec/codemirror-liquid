import CodeMirror from "codemirror";

var Pos = CodeMirror.Pos, cmpPos = CodeMirror.cmpPos;

function deepFind(obj, path) {
  var paths = path.split('.')
    , current = obj
    , i;

  for (i = 0; i < paths.length; ++i) {
    if (current[paths[i]] == undefined) {
      return undefined;
    } else {
      current = current[paths[i]];
    }
  }
  return current;
}

function set(str) {
  var obj = {}, words = str.split(" ");
  for (var i = 0; i < words.length; ++i) obj[words[i]] = true;
  return obj;
}

function getText(item) {
  return typeof item == "string" ? item : item.text;
}

function isArray(val) { return Object.prototype.toString.call(val) == "[object Array]" }

function match(string, word) {
  var len = string.length;
  var sub = getText(word).substr(0, len);
  return string.toUpperCase() === sub.toUpperCase();
}

function addMatches(result, search, wordlist, formatter) {
  if (isArray(wordlist)) {
    for (var i = 0; i < wordlist.length; i++)
      if (match(search, wordlist[i])) result.push(formatter(wordlist[i]))
  } else {
    for (var word in wordlist) if (wordlist.hasOwnProperty(word)) {
      var val = wordlist[word]
      if (!val || val === true)
        val = word
      else
        val = val.displayText ? {text: val.text, displayText: val.displayText} : val.text
      if (match(search, val)) result.push(formatter(val))
    }
  }
}

function buildCompletion(start, attrs) {
  var result = attrs.map(function(a) {
    return {text: [start, a].join('.'), displayText: a};
  });
  return result;
}

var locationAttr = "course altitude latitude longitude speed comments company_name contact email mobile establishment administrative_area administrative_area_code iso_country_code locality location_type postal_code sub_administrative_area sub_locality sub_thoroughfare thoroughfare handling pre_validated".split(' ');
var userAttr = 'id first_name last_name mobile email profile_image_url bio name full_name'.split(' ');
var companyAttr = 'name email channel allocation_enabled'.split(' ');
var retailerAttr = 'id name customer_number email phone_number url logo_image_url background_image_url host_name tags vatin commercial_in location billing_location payment_method job_number_format primary_color invoice_image_url'.split(' ');
var table = {
  "shipment": 'id human_id origin destination user courier customer company quantity weight dimensions waybill_nr job_number comments distance duration price payout_cents currency reference customer_reference pickup_code dropoff_code final_consignee kind channel service_type retailer hub vehicle_type state customer_account_number allocated_count pickup_milkrun_position dropoff_milkrun_position personal_message invoice_contact stocking_location creation_state start_planning_at flight_number flight_number_info payment_url quoted_by assigned_by accepted_by scanned_by purchased_by declined_by approved_by held_by released_by paused_by unpaused_by pickedup_by handedover_by droppedoff_by confirmed_by cancelled_by unfulfilled_by allocated_by unallocated_by stored_by unstored_by returned_by created_at updated_at quoted_at assigned_at accepted_at scanned_at purchased_at declined_at approved_at held_at released_at paused_at unpaused_at pickedup_at handedover_at droppedoff_at confirmed_at cancelled_at unfulfilled_at allocated_at unallocated_at stored_at unstored_at returned_at'.split(' '),
  "shipment.origin": locationAttr,
  "shipment.destination": locationAttr,
  "shipment.user": userAttr,
  "shipment.courier": userAttr,
  "shipment.retailer": retailerAttr,
  "shipment.company": companyAttr,
  "company": companyAttr,
  "retailer": retailerAttr,
  "user": userAttr
};

function nameCompletion(cur, token, result, editor) {
  var start = token.start;

  var parts = token.string.split('.').filter(t => t.length > 0);
  var key;

  for (var i = 0; i < parts.length; i++){
    key = parts.slice(0,parts.length-i).join('.');
    if(table[key]) {
      break;
    }
  }

  addMatches(result, token.string, buildCompletion(key, table[key]), function(w) {return w;});

  return start;
}

CodeMirror.defineSimpleMode("liquid-tags", {
  start: [
    { regex: /\{\%/,   push: "liquid", token: "tag" },
    { regex: /\{\{/,    push: "variables", token: "tag" }
  ],
  variables: [
    { regex: /\}\}/, pop: true, token: "tag" },

    // Double and single quotes
    { regex: /"(?:[^\\"]|\\.)*"?/, token: "string" },
    { regex: /'(?:[^\\']|\\.)*'?/, token: "string" },

    // Numeral
    { regex: /\d+/i, token: "number" },

    // Atoms like = and .
    { regex: /=|~|@|true|false/, token: "atom" },

    // Paths
    { regex: /(?:\.\.\/)*(?:[A-Za-z_][\w\.]*)+/, token: "variable-2" }
  ],
  liquid: [
    { regex: /\%\}/, pop: true, token: "tag" },

    // Double and single quotes
    { regex: /"(?:[^\\"]|\\.)*"?/, token: "string" },
    { regex: /'(?:[^\\']|\\.)*'?/, token: "string" },

    // liquid keywords
    { regex: />|[#\/]([A-Za-z_]\w*)/, token: "keyword" },
    { regex: /(?:else|this)\b/, token: "keyword" },

    // Numeral
    { regex: /\d+/i, token: "number" },

    // Atoms like = and .
    { regex: /=|~|@|true|false|\|/, token: "atom" },

    // Paths
    { regex: /(?:\.\.\/)*(?:[A-Za-z_][\w\.]*)+/, token: "variable-2" }
  ]
});

CodeMirror.defineMode("liquid", function(config, parserConfig) {
  var liquid = CodeMirror.getMode(config, "liquid-tags");
  if (!parserConfig || !parserConfig.base) return liquid;
  return CodeMirror.multiplexingMode(
    CodeMirror.getMode(config, parserConfig.base),
    {open: /\{[{{%]/, close: /[}%]\}/, mode: liquid, parseDelimiters: true}
  );
});

CodeMirror.registerHelper("hint", "liquid-tags", function(editor, options) {
  var keywords = set("if else elsif endif for continue break endfor unless endunless case when endcase assign");
  var filters = set("abs append at_least at_most capitalize ceil compact concat date default divided_by downcase escape escape_once first floor join last lstrip map minus modulo newline_to_br plus prepend remove remove_first replace replace_first reverse round rstrip size slice sort sort_natural split strip strip_html strip_newlines times truncate truncatewords uniq upcase url_decode url_encode");
  var identifierQuote = "'";

  var cur = editor.getCursor();
  var result = [];
  var token = editor.getTokenAt(cur), start, end, search;
  if (token.end > cur.ch) {
    token.end = cur.ch;
    token.string = token.string.slice(0, cur.ch - token.start);
  }

  if (token.string.match(/^[\.\w]*$/)) {
    search = token.string;
    start = token.start;
    end = token.end;
  } else {
    start = end = cur.ch;
    search = "";
  }
  // console.log('search', search, token);
  if (token.string.match(/^[\.\w]*$/)) {
    start = nameCompletion(cur, token, result, editor);
  } else {
    addMatches(result, search, filters, function(w) {return w;});
    addMatches(result, search, keywords, function(w) {return w;});
  }

  return {list: result, from: Pos(cur.line, start), to: Pos(cur.line, end)};
});
