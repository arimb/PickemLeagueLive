var pickem = [];
var draft = [['Popped Cargo', ['195', '217','225','1241','1720','1730','3478']],
			 ['TBC', ['319','330','1073','3538','5460']],
			 ['QD', ['910','930','1410','2337','2481','3707']],
			 ['ROBOTICS', ['48','51','107','2910','5801','6443','7457','7498']],
			 ['The Brian Griffins', ['111','1024','2056','2168','2614','4028']],
			 ['Cup Of Joe', ['234','364','868','1676','3357','4362','5406','5511']],
			 ['Just OK Robotics', ['548','1718','1923','2075','3357','3604','4607','4776','5205']],
			 ['TLC', ['33','340','1684','2767','3847','4265']],
			 ['The Maple Alliance', ['88','1114','1690','2468','3641']],
			 ['Squad Behind The Glass', ['118','461','1023','1747','1807','2403','3940','5190']]];

$(document).ready(function(){
	$('button#go').click(update)

	var request = new XMLHttpRequest();
	request.open('GET', 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwJYnOBxFrHEqL87iRbxo-NuI8-cH0dyGUYcwjampLDKMl_HcvEY5Xq7EDgYr9tjdRafSdqRT2LJVX/pub?output=tsv', true);
	request.onload = function(){
		this.response.split('\n').slice(1).forEach(function(line){
			var elements = line.split('\t');
			if(parseInt(elements[0].substring(2))>200) return;
			var name = elements[2];
			if(name==='') name = elements[1];
			var picks = elements[3].split(', ').map(function(str){
				var start = str.indexOf('FRC ')+4;
				return str.substring(start, str.indexOf(' ', start));
			});
			pickem.push([name, picks]);
			var row = $('table#pickem tbody')[0].insertRow(-1);
			row.insertCell(0);
			row.insertCell(1).innerHTML = name;
			row.insertCell(2).innerHTML = picks.join(', ');
			row.insertCell(3);
		});
	};
	request.onerror = function(err){console.log(err);}
	request.send();

	draft.forEach(function(line){
		var row = $('table#draft tbody')[0].insertRow(-1);
		row.insertCell(0);
		row.insertCell(1).innerHTML = line[0];
		row.insertCell(2).innerHTML = line[1].join(', ');
		row.insertCell(3);
	})

	$('tbody td').css('text-align', 'left');
	$('button#go').click();
});

function update(){
	var request = new XMLHttpRequest();
	request.open('GET', 'https://www.thebluealliance.com/api/v3/event/2019iri/teams/statuses', true);
	request.setRequestHeader('X-TBA-Auth-Key', 'h28l9eYEBtOCXpcFQN821YZRbjr0rTh2UdGFwqVf2jb36Sjvx2xYyUrZB5MPVJwv');
	request.setRequestHeader('accept', 'application/json');
	request.onload = function(){
		// try{
			var data = JSON.parse(this.response);
			
			var scores = pickem.map(val => val[1].map(pick => points(data['frc'+pick])).reduce((a,b) => a+b, 0));
			pickem2 = zip([pickem, scores]).sort((a,b) => a[1]-b[1]).reverse();
			$('table#pickem tbody').html('');
			pickem2.forEach(function(val, i){
				var row = $('table#pickem tbody')[0].insertRow(-1);
				row.insertCell(0).innerHTML = i+1;
				row.insertCell(1).innerHTML = val[0][0];
				row.insertCell(2).innerHTML = val[0][1].join(', ');
				row.insertCell(3).innerHTML = val[1];
			});

			scores = draft.map(val => val[1].map(pick => points(data['frc'+pick])).reduce((a,b) => a+b, 0));
			draft2 = zip([draft, scores]).sort((a,b) => a[1]-b[1]).reverse();
			$('table#draft tbody').html('');
			draft2.forEach(function(val, i){
				var row = $('table#draft tbody')[0].insertRow(-1);
				row.insertCell(0).innerHTML = i+1;
				row.insertCell(1).innerHTML = val[0][0];
				row.insertCell(2).innerHTML = val[0][1].join(', ');
				row.insertCell(3).innerHTML = val[1];
			});

			var last = 0;
			for(var key in data){
				if(!data[key]) return 0;
				if(matchnum_encode(data[key]['last_match_key']) > last) last = matchnum_encode(data[key]['last_match_key']);
			}
			
			$('div#last-updated').html('Last match ' + matchnum_decode(last) + '. Last updated ' + new Date().toLocaleTimeString());
		// }catch(err){
		// 	$('div#last-updated').html('Error loading event status.');
		// }
	};
	request.onerror = function(){
		$('div#last-updated').html('Error loading event status.');
	};
	request.send();
}

function points(status){
	if(!status) return 0;
	if(!status['qual']) return 0;
	var tmp = Math.ceil(7.676*erfinv((status['qual']['num_teams']-2*status['qual']['ranking']['rank']+2)/(1.07*status['qual']['num_teams']))+12);
	if(status['alliance']){
		if(status['alliance']['pick']<=1) tmp += 17-status['alliance']['number'];
		else if(status['alliance']['pick']==2) tmp += 9-status['alliance']['number'];
	}
	if(status['playoff']) tmp += status['playoff']['record']['wins']*5;
	return tmp;
}

function matchnum_encode(key){
	var i = key.indexOf('_')+1;
	var j = key.slice(i).search(/[0-9]/)+i;
	return {'qm':0, 'qf':200, 'sf':300, 'f':400}[key.substring(i, j)] + parseFloat(key.substring(j).replace(/m/g, '.'));
}

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

function zip(arrays) {
    return Array.apply(null,Array(arrays[0].length)).map(function(_,i){
        return arrays.map(function(array){return array[i]})
    });
}