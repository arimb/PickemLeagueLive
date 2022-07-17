var events = {}
var pickem = [];
var draft = {};

$(window).resize(function(){
	if($(this).width() < 600){
		$('div#logo').hide();
		$('div#spacer').show();
	}else{
		$('div#logo').show();
		$('div#spacer').hide();
	}

	if($(this).width() < 700){
		$('div#title').css('position','static');
		$('div#title').css('width','auto');
		$('div#title').css('margin-left','0px');
	}else{
		$('div#title').css('position','absolute');
		$('div#title').css('width','450px');
		$('div#title').css('margin-left','-225px');
	}
})

$(document).ready(function(){
	$(window).resize();
	$('button#go').click(update);	//set update button click function
	
	//get draft lists and event id/url for all events
	var request = new XMLHttpRequest();
	request.open('GET', 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTJPy6YhVVER4jqGS4nroJGXO_TSbQaa2ud3rpuNC0pgnKcQOBKIExPIGZnfc81VadZuGJKpwoGC1pl/pub?output=tsv', true);
	request.onload = function(){
		this.response.split('\n').slice(1).forEach(function(line){	//for each event
			if(line.trim()==='') return;
			var vals = line.split('\t');
			events[vals[0]] = vals.slice(1,4);	//save event id/url in global
			draft[vals[0]] = [];
			vals.slice(4).filter(team => team.length>0).forEach(function(list){	//for each draft team
				if(list.trim()==='') return;
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
		$('div#last-updated').html('Loading...');
		var request = new XMLHttpRequest();
		request.open('GET', $('select#event').children('option:selected')[0].value.split(',')[1], true);
		// request.setRequestHeader('Cache-Control', 'no-cache');
		request.onload = function(){
			pickem = [];
			this.response.split('\n').slice(1).forEach(function(line){		//for each pickem team
				if(line.trim()==='') return;
				console.log(line);
				var elements = line.split('\t');
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
	$('div#last-updated').html('Loading...');
	const promises = ['teams/statuses','matches/simple'].map(endpoint => new Promise(resolve => {		//make API calls
   		var url = 'https://www.thebluealliance.com/api/v3/event/' + $('select#event').children('option:selected')[0].value.split(',')[0] + '/' + endpoint;
		resolve($.getJSON(url, 'accept=application/json&X-TBA-Auth-Key=h28l9eYEBtOCXpcFQN821YZRbjr0rTh2UdGFwqVf2jb36Sjvx2xYyUrZB5MPVJwv'));
	}));

	Promise.all(promises).then(results => {		//when all API calls finish...
		var points = {};
		for(var team in results[0]){
			if(!results[0][team]){points[team] = 0; continue;}
			if(!results[0][team]['qual']){points[team] = 0; continue;}
			if(!results[0][team]['qual']['ranking']){points[team] = 0; continue;}
			if(!results[0][team]['qual']['ranking']['rank']){points[team] = 0; continue;}
			var tmp = Math.ceil(7.676*erfinv((results[0][team]['qual']['num_teams']-2*results[0][team]['qual']['ranking']['rank']+2)/(1.07*results[0][team]['qual']['num_teams']))+12);		//assign each team qual scores
			if(results[0][team]['alliance']){		//if team is selected, add their alliance selection scores
				if($('select#event option:selected').val().split(',')[0].toLowerCase().includes("iri")) {
					// IRI reverse draft
					if(results[0][team]['alliance']['pick']<2) tmp += 17-results[0][team]['alliance']['number'];
					else if(results[0][team]['alliance']['pick']==2) tmp += 9-results[0][team]['alliance']['number'];
				} else {
					if(results[0][team]['alliance']['pick']<2) tmp += 17-results[0][team]['alliance']['number'];
					else if(results[0][team]['alliance']['pick']==2) tmp += results[0][team]['alliance']['number'];
				}
			}
			points[team] = tmp;
		}
		results[1].forEach(function(match){		//for each match played...
			if(match['comp_level'] == 'qm' || !match['winning_alliance']) return;		//if it's a playoff match...
			match['alliances'][match['winning_alliance']]['team_keys'].forEach(function(team){		//for each team that won the match...
				points[team] += 5;		//add playoff points
			});
		});

		var prices = {};
		$('select#event').children('option:selected')[0].value.split(',').slice(2).map(str => str.trim()).map(function(str){
			var start = str.indexOf('FRC ')+4;
			return [str.substring(start, str.indexOf(' ', start)), parseInt(str.substring(1, str.indexOf(' ')))];
		}).forEach(function(val){
			prices[val[0]] = val[1];
		});
		console.log(prices);
		$('table#teams tbody').html('');		//clear teams table
		Object.keys(points).forEach(function(team, i){
			var row = $('table#teams tbody')[0].insertRow(-1);
			row.insertCell(0).innerHTML = i;
			row.insertCell(1).innerHTML = team.substring(3);
			row.insertCell(2).innerHTML = points[team];
			row.insertCell(3).innerHTML = '$' + prices[team.substring(3)];
			row.insertCell(4).innerHTML = (points[team]/prices[team.substring(3)]).toFixed(2);
		});
		$('table#teams th:nth-child(3)').click();

		// $('table#teams tbody').html('');		//clear teams table
		// var points2 = Object.keys(points).sort(function(a,b){return points[b]-points[a]}).map(team => [team, points[team]]);		//sort teams by points
		// points2.forEach(function(team, i){		//...add each to table
		// 	var row = $('table#teams tbody')[0].insertRow(-1);
		// 	row.insertCell(0).innerHTML = (i==0?1:points2[i-1][1]==team[1]?'':i+1);
		// 	row.insertCell(1).innerHTML = team[0].substring(3);
		// 	row.insertCell(2).innerHTML = team[1];
		// });
		
		var pickem2 = pickem.map(val => [val, val[1].map(pick => points['frc'+pick]).filter(points => !isNaN(points)).reduce((a,b) => a+b, 0)])	//calculate scores for all pickem teams...
			.sort((a,b) => a[1]-b[1]).reverse();	//...and sort
		$('table#pickem tbody').html('');		//clear pickem table
		pickem2.forEach(function(val, i){		//insert row for each pickem team and fill with data
			var row = $('table#pickem tbody')[0].insertRow(-1);
			row.insertCell(0).innerHTML = (i==0?1:pickem2[i-1][1]==val[1]?'':i+1);
			row.insertCell(1).innerHTML = val[0][0];
			row.insertCell(2).innerHTML = val[0][1].join(', ');
			row.insertCell(3).innerHTML = val[1];
		});

		var draft2 = draft[$('select#event').children('option:selected')[0].text].map(val => [val, val[1].map(pick => points['frc'+pick]).filter(points => !isNaN(points)).reduce((a,b) => a+b, 0)])	//calculate scores for all draft teams...
			.sort((a,b) => a[1]-b[1]).reverse();	//...and sort
		$('table#draft tbody').html('');		//clear draft table
		draft2.forEach(function(val, i){		//insert row for each draft team and fill with data
			var row = $('table#draft tbody')[0].insertRow(-1);
			row.insertCell(0).innerHTML = (i==0?1:draft2[i-1][1]==val[1]?'':i+1);
			row.insertCell(1).innerHTML = val[0][0];
			row.insertCell(2).innerHTML = val[0][1].join(', ');
			row.insertCell(3).innerHTML = val[1];
		});

		if(draft2.length == 0){
			$('details#draft').css('display','none');
		}else{
			$('details#draft').css('display','block');
		}

		//find last played match
		var last = 0;
		for(var key in results[1]){
			if(!results[1][key]) continue;
			if(results[1][key]['alliances']['red']['score'] == -1) continue;
			if(matchnum_encode(results[1][key]) > last) last = matchnum_encode(results[1][key]);
		}
		
		$('div#last-updated').html('Last match ' + matchnum_decode(last) + '. Updated ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
	});
}

//encode match key to number
function matchnum_encode(match){
	return {'qm':0, 'qf':1000, 'sf':2000, 'f':3000}[match['comp_level']] + match['match_number'] + (match['set_number']/10);
}

//decode match key from number
function matchnum_decode(num){
	return {0:'qm', 1:'qf', 2:'sf', 3:'f'}[Math.floor(num/1000)] + ((Math.floor(num/1000)==0)?'':(Math.round((num%1)*10) + '-')) + (Math.floor(num)%1000);
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

function sortTable(n) {
  var table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
  table = $('table#teams')[0];
  switching = true;
  dir = ["", "asc", "desc", "desc", "desc"][n];
  /* Make a loop that will continue until
  no switching has been done: */
  while (switching) {
    // Start by saying: no switching is done:
    switching = false;
    rows = table.rows;
    /* Loop through all table rows (except the
    first, which contains table headers): */
    for (i = 1; i < (rows.length - 1); i++) {
      // Start by saying there should be no switching:
      shouldSwitch = false;
      /* Get the two elements you want to compare,
      one from current row and one from the next: */
      x = rows[i].getElementsByTagName("TD")[n];
      y = rows[i + 1].getElementsByTagName("TD")[n];
      /* Check if the two rows should switch place,
      based on the direction, asc or desc: */
      if (dir == "asc") {
        if (parseInt(x.innerHTML.toLowerCase().replace('$','')) > parseInt(y.innerHTML.toLowerCase().replace('$',''))) {
          // If so, mark as a switch and break the loop:
          shouldSwitch = true;
          break;
        }
      } else if (dir == "desc") {
        if (parseInt(x.innerHTML.toLowerCase().replace('$','')) < parseInt(y.innerHTML.toLowerCase().replace('$',''))) {
          // If so, mark as a switch and break the loop:
          shouldSwitch = true;
          break;
        }
      }
    }
    if (shouldSwitch) {
      /* If a switch has been marked, make the switch
      and mark that a switch has been done: */
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      // Each time a switch is done, increase this count by 1:
      switchcount ++;
    } else {
      /* If no switching has been done AND the direction is "asc",
      set the direction to "desc" and run the while loop again. */
      if (switchcount == 0 && dir == "asc") {
        dir = "desc";
        switching = true;
      }
    }
  }

  $('table#teams tr:nth-child(1):has(td)')[0].children[0].innerHTML = 1;
  for (var i = 2; i < $('table#teams tr').length-2; i++) {
  	if($('table#teams tr:nth-child('+(i-1)+'):has(td)')[0].children[n].innerHTML == $('table#teams tr:nth-child('+i+'):has(td)')[0].children[n].innerHTML)
  		$('table#teams tr:nth-child('+i+'):has(td)')[0].children[0].innerHTML = '';
  	else
  		$('table#teams tr:nth-child('+i+'):has(td)')[0].children[0].innerHTML = i;
  }
}