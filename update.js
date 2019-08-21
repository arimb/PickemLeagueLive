var events = {}
var pickem = [];
var draft = {};

$(document).ready(function(){
	$('button#go').click(update);	//set update button click function
	
	//get draft lists and event id/url for all events
	var request = new XMLHttpRequest();
	request.open('GET', 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTJPy6YhVVER4jqGS4nroJGXO_TSbQaa2ud3rpuNC0pgnKcQOBKIExPIGZnfc81VadZuGJKpwoGC1pl/pub?output=tsv', true);
	// request.setRequestHeader('Cache-Control', 'no-cache');
	request.onload = function(){
		this.response.split('\n').slice(1).forEach(function(line){	//for each event
			var vals = line.split('\t');
			events[vals[0]] = vals.slice(1,3);	//save event id/url in global
			draft[vals[0]] = [];
			vals.slice(3).filter(team => team.length>0).forEach(function(list){	//for each draft team
				draft[vals[0]].push([list.substring(0,list.indexOf('-')), list.substring(list.indexOf('-')+1).split(',').map(team => team.trim())]);		//add draft team to global
			});
		});
		Object.keys(events).forEach(function(event){	//add all events to dropdown list
			$('select#event').append($('<option>', {
				text: event,
				value: events[event]
			}));
		});
		$('select#event').change();		//import pickem lists
	};
	request.onerror = function(err){console.log(err);};
	request.send();

	//get pickem lists for current event
	$('select#event').change(function(){
		var request = new XMLHttpRequest();
		request.open('GET', $('select#event').children('option:selected')[0].value.split(',')[1], true);
		// request.setRequestHeader('Cache-Control', 'no-cache');
		request.onload = function(){
			pickem = [];
			this.response.split('\n').slice(1).forEach(function(line){		//for each pickem team
				var elements = line.split('\t');
				// if(parseInt(elements[0].substring(2))>200) return;		//reject teams over $200
				var name = elements[3];		//default name is optional team name
				if(name==='') name = elements[2];		//if no team name, use user first name
				var sum = 0;
				var picks = elements[5].split(', ').map(function(str){		//parse team numbers from list
					sum += parseInt(str.substring(1, str.indexOf(' ')));
					var start = str.indexOf('FRC ')+4;
					return str.substring(start, str.indexOf(' ', start));
				});
				if(sum<=200) pickem.push([name, picks]);		//add team name and list to global
			});
			$('button#go').click();		//update scores
		};
		request.onerror = function(err){console.log(err);};
		request.send();
	});
});

//update scores for draft and pickem
function update(){
	const promises = ['teams/statuses','matches/simple'].map(endpoint => new Promise(resolve => {
   		var url = 'https://www.thebluealliance.com/api/v3/event/' + $('select#event').children('option:selected')[0].value.split(',')[0] + '/' + endpoint;
		resolve($.getJSON(url, 'accept=application/json&X-TBA-Auth-Key=h28l9eYEBtOCXpcFQN821YZRbjr0rTh2UdGFwqVf2jb36Sjvx2xYyUrZB5MPVJwv'));
	}));

	Promise.all(promises).then(results => {
		var points = {};
		for(var team in results[0]){
			if(!results[0][team]){points[team] = 0; continue;}
			if(!results[0][team]['qual']){points[team] = 0; continue;}
			var tmp = Math.ceil(7.676*erfinv((results[0][team]['qual']['num_teams']-2*results[0][team]['qual']['ranking']['rank']+2)/(1.07*results[0][team]['qual']['num_teams']))+12);
			if(results[0][team]['alliance']){
				if(results[0][team]['alliance']['pick']<2) tmp += 17-results[0][team]['alliance']['number'];
				else if(results[0][team]['alliance']['pick']==2) tmp += results[0][team]['alliance']['number'];
			}
			points[team] = tmp;
		}
		results[1].forEach(function(match){
			if(match['comp_level'] == 'qm') return;
			match['alliances'][match['winning_alliance']]['team_keys'].forEach(function(team){
				points[team] += 5;
			});
		});
		
		var pickem2 = pickem.map(val => [val, val[1].map(pick => points['frc'+pick]).filter(points => !isNaN(points)).reduce((a,b) => a+b, 0)])	//calculate scores for all pickem teams...
			.sort((a,b) => a[1]-b[1]).reverse();	//...and sort
		$('table#pickem tbody').html('');		//clear pickem table
		pickem2.forEach(function(val, i){		//insert row for each pickem team and fill with data
			var row = $('table#pickem tbody')[0].insertRow(-1);
			row.insertCell(0).innerHTML = i+1;
			row.insertCell(1).innerHTML = val[0][0];
			row.insertCell(2).innerHTML = val[0][1].join(', ');
			row.insertCell(3).innerHTML = val[1];
		});

		var draft2 = draft[$('select#event').children('option:selected')[0].text].map(val => [val, val[1].map(pick => points['frc'+pick]).filter(points => !isNaN(points)).reduce((a,b) => a+b, 0)])	//calculate scores for all draft teams...
			.sort((a,b) => a[1]-b[1]).reverse();	//...and sort
		$('table#draft tbody').html('');		//clear draft table
		draft2.forEach(function(val, i){		//insert row for each draft team and fill with data
			var row = $('table#draft tbody')[0].insertRow(-1);
			row.insertCell(0).innerHTML = i+1;
			row.insertCell(1).innerHTML = val[0][0];
			row.insertCell(2).innerHTML = val[0][1].join(', ');
			row.insertCell(3).innerHTML = val[1];
		});
		$('tbody td').css('text-align', 'left');

		//find last played match
		var last = 0;
		for(var key in results[1]){
			if(!results[1][key]) return 0;
			if(results[1][key]['alliances']['red']['score'] == -1) return 0;
			if(matchnum_encode(results[1][key]['key']) > last) last = matchnum_encode(results[1][key]['key']);
		}
		
		$('div#last-updated').html('Last match ' + matchnum_decode(last) + '. Last updated ' + new Date().toLocaleTimeString());
	});
}

//encode match key to number
function matchnum_encode(key){
	var i = key.indexOf('_')+1;
	var j = key.slice(i).search(/[0-9]/)+i;
	return {'qm':0, 'qf':200, 'sf':300, 'f':400}[key.substring(i, j)] + parseFloat(key.substring(j).replace(/m/g, '.'));
}

//decode match key from number
function matchnum_decode(num){
	var lvl = ['qm', 0];
	if(num >= 200) lvl = ['qf', 200];
	if(num >= 300) lvl = ['sf', 300];
	if(num >= 400) lvl = ['f', 400];
	return lvl[0] + (num - lvl[1]).toFixed(1).replace(/\./, '-');
}

function erfinv(x){
        var z;
        var a  = 0.147;                                                   
        var the_sign_of_x;
        if(0==x) {
            the_sign_of_x = 0;
        } else if(x>0){
            the_sign_of_x = 1;
        } else {
            the_sign_of_x = -1;
        }

        if(0 != x) {
            var ln_1minus_x_sqrd = Math.log(1-x*x);
            var ln_1minusxx_by_a = ln_1minus_x_sqrd / a;
            var ln_1minusxx_by_2 = ln_1minus_x_sqrd / 2;
            var ln_etc_by2_plus2 = ln_1minusxx_by_2 + (2/(Math.PI * a));
            var first_sqrt = Math.sqrt((ln_etc_by2_plus2*ln_etc_by2_plus2)-ln_1minusxx_by_a);
            var second_sqrt = Math.sqrt(first_sqrt - ln_etc_by2_plus2);
            z = second_sqrt * the_sign_of_x;
        } else { // x is zero
            z = 0;
        }
  return z;
}