'use strict';
import _ from 'underscore';
import {PFLog, PFConsole} from './PFLog';
import TAS from 'exports-loader?TAS!TheAaronSheet';
import * as SWUtils from './SWUtils';
import PFConst from './PFConst';
import * as PFUtils  from './PFUtils';
import * as PFAbilityScores from './PFAbilityScores';
import * as PFSaves from './PFSaves';
import * as PFAttackGrid from './PFAttackGrid';
import * as PFAttacks from './PFAttacks';
import * as PFDefense from './PFDefense';
import * as PFHealth from  './PFHealth';
import * as PFChecks from './PFChecks';
import * as PFInitiative from './PFInitiative';
import * as PFEncumbrance from './PFEncumbrance';
import * as PFSize from './PFSize';
import * as PFSkills from './PFSkills';

//new  cmb, dmg_ranged, armor, shield, natural, flat-footed, speed, initiative, size
// added:init, speed, dmg_ranged, cmb
var bonusTypes =['untyped','alchemical','circumstance','competance','enhancement','inherent',
	'insight','luck','morale','profane','racial','sacred','size','trait','feat','equivalent','ability','equivalent',
	'deflection','dodge','force','customa','customb','customc'],
stackingTypes =['untyped','circumstance','dodge','penalty'],
acToCMDTypes =[ 'untyped','circumstance','deflection','dodge','insight','luck','morale','profane','sacred'],
acToTouchTypes = ['dodge','deflection'],
armorToTouchTypes = ['force'],

buffColumns = ['Ranged', 'Melee','CMB', 'DMG', 'DMG_ranged','DMG_melee',
	'AC', 'Touch', 'CMD', 'armor','shield','natural','flat-footed',
	'speed', 'initiative','size',
	'HP-temp', 'Fort', 'Will', 'Ref', 'Check','check_ability','check_skills', 'CasterLevel',
	'STR','DEX','CON','INT','WIS','CHA',
	'STR_skills','DEX_skills','CON_skills','INT_skills','WIS_skills','CHA_skills' ],
events = {
	// events pass in the column updated macro-text is "either", buffs are auto only
	buffTotalNonAbilityEvents: {
		//ranged and attack are in the PFAttackGrid module
		"Fort": [PFSaves.updateSave],
		"Will": [PFSaves.updateSave],
		"Ref": [PFSaves.updateSave]
	},
	buffTotalAbilityEvents: {
		"STR": [PFAbilityScores.updateAbilityScore],
		"DEX": [PFAbilityScores.updateAbilityScore],
		"CON": [PFAbilityScores.updateAbilityScore],
		"INT": [PFAbilityScores.updateAbilityScore],
		"WIS": [PFAbilityScores.updateAbilityScore],
		"CHA": [PFAbilityScores.updateAbilityScore]
	},
	// events do NOT pass in column updated
	buffTotalEventsNoParam: {
		"Melee": [PFAttackGrid.updateMelee],
		"Ranged": [PFAttackGrid.updateRanged],
		"CMB": [PFAttackGrid.updateCMB],
		"DMG": [PFAttackGrid.updateDamage],
		"DMG_ranged": [PFAttacks.updateRepeatingWeaponDamages],
		"AC": [PFDefense.updateDefenses],
		"Touch": [PFDefense.updateDefenses],
		"armor": [PFDefense.updateDefenses],
		"shield": [PFDefense.updateDefenses],
		"natural": [PFDefense.updateDefenses],
		"flat-footed": [PFDefense.updateDefenses],
		"CMD": [PFDefense.updateDefenses],
		"HP-temp": [PFHealth.updateTempMaxHP],
		"Check": [PFChecks.applyConditions],
		"check_skills": [PFSkills.recalculate],
		"initative": [PFInitiative.updateInitiative],
		"speed": [PFEncumbrance.updateModifiedSpeed],
		"size": [PFSize.updateSizeAsync]
	}
};


function updateBuffTotals (col, callback) {
	var tempstr='',
	done = _.once(function () {
		TAS.debug("leaving PFBuffs.updateBuffTotals for "+col);
		if (typeof callback === "function") {
			callback();
		}
	}),	
	isAbility = (PFAbilityScores.abilities.indexOf(col) >= 0),
	bonuses = {
			'ability':0,'alchemical':0,'circumstance':0,'competance':0,'customa':0,'customb':0,'customc':0,
			'deflection':0,'dodge':0,'enhancement':0,'equivalent':0,'feat':0,'force':0,'inherent':0,
			'insight':0,'luck':0,'morale':0,'penalty': 0,'profane':0,'racial':0,'sacred':0,
			'size':0,'trait':0,'untyped':0,'notype':0
		};
	try {
		TAS.repeating('buff').attrs('buff_' + col + '-total', 'buff_' + col + '-total_penalty').fields('buff-' + col, 'buff-'+col+'_type', 'buff-' + col + '-show', 'buff-enable_toggle').reduce(function (m, r) {
			try {
				var tempM = 0,bonusType='';
				try {
					if(col!=='size'&&col!=='HP-temp'){
						bonusType = r.S['buff-'+col+'_type']||'untyped';
					}
				} catch (err2){
					bonusType='untyped';
					TAS.error("updateBuffTotals Error trying to retreive type: "+'buff-'+col+'_type',err2);
				}
				if( (r.I['buff-enable_toggle']||0) && (r.I['buff-' + col + '-show']||0)) {
					tempM=r.I['buff-' + col]||0;
					if(tempM!==0){
						if(tempM<0){
							bonusType='penalty';
						}
						if (col==='size') {
							if(bonusType!=='penalty'){
								m.notype = Math.max(m.notype,tempM);
							} else {
								//shrinking is not really 'penalty' 
								m.penalty = Math.min(m.penalty,tempM);
							}
						} else if (col==='HP-temp'){
							m.notype = Math.max(m.notype,tempM);
						} else if(stackingTypes.includes(bonusType) ) {
							m[bonusType] += tempM;
						} else{
							m[bonusType] = Math.max(m[bonusType],tempM);
						}
						TAS.debug("after "+ tempM+ " " + bonusType + " newval is  "+ m[bonusType] + " for buff "+ col);
					}
				}
			} catch (err) {
				TAS.error("PFBuffs.updateBuffTotals error:" + col, err);
			} finally {
				return m;
			}
		}, {
			'ability':0,'alchemical':0,'circumstance':0,'competance':0,'customa':0,'customb':0,'customc':0,
			'deflection':0,'dodge':0,'enhancement':0,'equivalent':0,'feat':0,'force':0,'inherent':0,
			'insight':0,'luck':0,'morale':0,'penalty': 0,'profane':0,'racial':0,'sacred':0,
			'size':0,'trait':0,'untyped':0,'notype':0
		}, 
		function (m, r, a) {
			var sum=0,pen=0;
			try {
				if (col==='size'||col==='HP-temp'){
					sum = m.notype;
				} else {
					sum = bonusTypes.reduce(function(s,t){
						TAS.notice('inside loop s:'+s+', t:'+t);
						s+=m[t];
						return s;
					},0);
				}
				//TAS.debug('setting buff_' + col + '-total to '+ (m.mod||0));
				if(!isAbility){
					sum+=m.penalty;
					m.penalty=0;
				}	
				a.S['buff_' + col + '-total'] = sum;
				toggleBuffStatusPanel(col,sum);
				if (isAbility) {
					a.S['buff_' + col + '-total_penalty'] = m.penalty;
					toggleBuffStatusPanel(col+'_penalty',m.penalty);
				}
				TAS.debug("updateBuffTotals setting ",a);
			} catch (errfinalset){
				TAS.error("error setting buff_" + col + "-total",errfinalset);
			}
		}).execute(done);
	} catch (err2) {
		TAS.error("PFBuffs.updateBuffTotals error:" + col, err2);
		done();
	}
}

//why did i make this? it just repeats the ability scores
//buffColumns.concat(PFAbilityScores.abilities),
/* this is so old no one will be using it*/
export function migrate (outerCallback) {
	var done = _.once(function () {
		TAS.debug("leaving PFBuffs.migrate");
		if (typeof outerCallback === "function") {
			outerCallback();
		}
	});
	getAttrs(["migrated_buffs", "migrated_effects"], function (v) {
		var setter = {};
		try {
			if (parseInt(v.migrated_buffs,10)!==1) {
				setter.migrated_buffs = 1;
			}
			if (parseInt(v.migrated_effects,10)!==1) {
				setter.migrated_effects = 1;
			}
		} catch (err) {
			TAS.error("PFBuffs.migrate", err);
		} finally {
			if (_.size(setter) > 0) {
				setAttrs(setter, {
					silent: true
				}, done);
			} else {
				done();
			}
		}
	});
}
/** createTotalBuffEntry - used by parseNPC
 * adds enabled buff for a new sheet where this is the only buff so sets total as well.
 * adds attributes to array passed in
 * @param {string} name name of buff row  for buff-name
 * @param {string} bufftype  -string from buffColumns
 * @param {string} buffmacro ?
 * @param {number} modamount - value for the buff
 * @param {map} newRowAttrs - object of {name:value} to pass to setAttrs
 * @returns {map} return newRowAttrs after adding maps to it.
 */
export function createTotalBuffEntry (name, bufftype, buffmacro, modamount, newRowAttrs) {
	var newRowId = generateRowID();
	newRowAttrs = newRowAttrs||{};
	newRowAttrs["repeating_buff_" + newRowId + "_buff-name"] = name;
	newRowAttrs["repeating_buff_" + newRowId + "_buff-" + bufftype + "_macro-text"] = buffmacro;
	newRowAttrs["repeating_buff_" + newRowId + "_buff-" + bufftype] = modamount;
	newRowAttrs["repeating_buff_" + newRowId + "_buff-" + bufftype + "-show"] = "1";
	newRowAttrs["repeating_buff_" + newRowId + "_buff-enable_toggle"] = "1";
	newRowAttrs["buff_" + bufftype + "-total"] = modamount;
	return newRowAttrs;
}
function resetStatuspanel (callback) {
	var done = _.once(function () { if (typeof callback === "function") { callback(); } }),
	 fields;

	try {
		fields = SWUtils.cartesianAppend(["buff_"], buffColumns, ["-total", "_exists"]).concat(
			SWUtils.cartesianAppend(["buff_"], PFAbilityScores.abilities, [ "-total_penalty",  "_penalty_exists"])
		).concat(
			SWUtils.cartesianAppend(["buff_"], PFAbilityScores.abilities, [ "_skills-total_penalty",  "_skills_penalty_exists"])
		);
		getAttrs(fields, function (v) {
			var setter = {},
			getExists= function(pre,post){
				var val,exists;
				post=post||'';
				val = parseInt(v[pre + "-total"+post], 10) || 0; 
				exists = parseInt(v[pre + "_exists"+post], 10) || 0;
				if (val !== 0 && !exists) {
					return 1;
				} else if (val === 0 && exists) {
					return "";
				}
			};
			try {
				setter = _.reduce(buffColumns, function (memo, col) {
					var pre;
					try {
						pre="buff_" + col;
						memo[pre+'_exists']=getExists(pre,'');
					} catch (erri1) { } finally {
						return memo;
					}
				}, setter);
				setter = _.reduce(PFAbilityScores.abilities, function (memo, col) {
					var pre;
					try {
						pre="buff_" + col;
						memo[pre+'_exists']=getExists(pre,'_penalty');
						pre+= '_skills';
						memo[pre+'_exists']=getExists(pre,'_penalty');						
					} catch (erri1) { } finally {
						return memo;
					}
				}, setter);
			} catch (err) {
				TAS.error("PFBuffs.resetStatuspanel error inside calculate exists", err);
			} finally {
				if (_.size(setter) > 0) {
					setAttrs(setter, { silent: true }, done);
				} else {
					done();
				}
			}
		});
	} catch (errO) {
		TAS.error("PFBuffs.resetStatuspanel error creating field array, abort:", errO);
		done();
	}
}
/* Sets 1 or 0 for buffexists in status panel - only called by updateBuffTotals. */

/**  but keep since we're redoing buffs soon
 * Updates buff_<col>_exists checkbox if the val paramter has a nonzero value
 * also switches it off
 * @param {string} col column name of buff to check
 * @param {int} val value of the buff
 */
function toggleBuffStatusPanel (col, val) {
	var field = "buff_" + col + "_exists";
	getAttrs([field], function (v) {
		var setter = {};
		try {
			if (val && parseInt(v[field],10)!==1) {
				setter[field] = "1";
			} else if (!val && parseInt(v[field],10)===1) {
				setter[field] = "";
			}
		} catch (err) {
			TAS.error("PFBuffs.toggleBuffStatusPanel", err);
		} finally {
			if (_.size(setter) > 0) {
				setAttrs(setter, { silent: true });
			}
		}
	});
}
function updateBuffTotalsOld (col, callback) {
	var tempstr='',
	done = _.once(function () {
		TAS.debug("leaving PFBuffs.updateBuffTotals for "+col);
		if (typeof callback === "function") {
			callback();
		}
	}),	
	isAbility = (PFAbilityScores.abilities.indexOf(col) >= 0);
	try {
		TAS.repeating('buff').attrs('buff_' + col + '-total', 'buff_' + col + '-total_penalty').fields('buff-' + col, 'buff-enable_toggle', 'buff-' + col + '-show').reduce(function (m, r) {
			try {
				var tempM = (r.I['buff-' + col] * ((r.I['buff-enable_toggle']||0) & (r.I['buff-' + col + '-show']||0)));
				tempM=tempM||0;
				TAS.debug("adding "+ tempM+" to m.mod:"+m.mod+" for buff "+ col);
				if(tempM!==0){
					if (tempM >= 0) {
						m.mod += tempM;
					} else {
						m.pen += tempM;
					}
				}
			} catch (err) {
				TAS.error("PFBuffs.updateBuffTotals error:" + col, err);
			} finally {
				return m;
			}
		}, {
			mod: 0,
			pen: 0
		}, function (m, r, a) {
			try {
				//TAS.debug('setting buff_' + col + '-total to '+ (m.mod||0));
				if(!isAbility){
					m.mod+=m.pen;
					m.pen=0;
				}
				if(col==='HP-temp' && m.mod < 0){
					m.mod=0;
				}
				a.I['buff_' + col + '-total'] = m.mod;
				toggleBuffStatusPanel(col,m.mod);
				if (isAbility) {
					a.I['buff_' + col + '-total_penalty'] = m.pen;
					toggleBuffStatusPanel(col+'_penalty',m.pen);
				}
				TAS.debug("updateBuffTotals setting ",m,r,a);
			} catch (errfinalset){
				TAS.error("error setting buff_" + col + "-total",errfinalset);
			}
		}).execute(done);
	} catch (err2) {
		TAS.error("PFBuffs.updateBuffTotals error:" + col, err2);
		done();
	}
}
export function clearBuffTotals(callback){
	var fields;
	fields = SWUtils.cartesianAppend(['buff_'],buffColumns,['-total','_exists']);
	fields = fields.concat(SWUtils.cartesianAppend(['buff_'],PFAbilityScores.abilities,['-total_penalty','_penalty_exists']));
	TAS.debug("PFBuffs.clearBuffTotals getting fields:",fields);
	getAttrs(fields,function(v){
		var setter={};
		TAS.notice("PFBuffs.clearBuffTotals we got back the following: ",v);
		setter = _.reduce(v,function(memo,val,attr){
			if ((/exists/).test(attr)){
				if (parseInt(val,10)){
					memo[attr]=0;
				}
			} else if (parseInt(val,10) || typeof val === "undefined"){
				memo[attr]=0;
			}
			return memo;
		},{});
		if (_.size(setter)){
			TAS.debug("PFBuffs.clearBuffTotals, setting",setter);
			setAttrs(setter,{},callback);
		} else {
			if (typeof callback ==="function"){
				callback();
			}
		}
	});
}
function setBuff (id, col, callback, silently) {
	var done = function () {
		if (typeof callback === "function") {
			callback();
		}
	},
	idStr = SWUtils.getRepeatingIDStr(id),
	prefix = "repeating_buff_" + idStr + "buff-" + col;
	SWUtils.evaluateAndSetNumber(prefix + "_macro-text", prefix,0,
		function(a,b,c){
			if (c){
				updateBuffTotals(col,done);
			} else {
				done();
			}
		},true,done);
}
export function recalculate (callback, silently, oldversion) {
	var done = _.once(function () {
		resetStatuspanel();
		TAS.debug("Leaving PFBuffs.recalculate");
		if (typeof callback === "function") {
			callback();
		}
	}),
	numColumns = _.size(buffColumns),
	columnDone = _.after(numColumns, done),
	colsDoneCount = 0,
	recalculateBuffColumn = function (ids, col) {
		var rowtotal = _.size(ids),
			totalItUp = _.once(function () {
				colsDoneCount++;
				updateBuffTotals(col, columnDone);
			}),
			rowDone;
		if (col==='size'){
			totalItUp();
			return;
		}
		rowDone = _.after(rowtotal, function () {
			totalItUp();
		});
		try {
			_.each(ids, function (id) {
				try {
					getAttrs(['repeating_buff_'+id+'_buff-enable_toggle',
					'repeating_buff_'+id+'_buff-' + col + '-show'],function(v){
						if (parseInt(v['repeating_buff_'+id+'_buff-enable_toggle'],10) && 
							parseInt(v['repeating_buff_'+id+'_buff-' + col + '-show'],10) ) {
								setBuff(id, col, rowDone, silently);
						} else {
							rowDone();
						}
					});
				} catch (err) {
					TAS.error("PFBuffs.recalculate_recalculateBuffColumn:" + col + ", rowid" + id, err);
					rowDone();
				}
			});
		} catch (err2) {
			TAS.error("PFBuffs.recalculate_recalculateBuffColumn OUTER error:" + col, err2);
			totalItUp();
		}
	};
	getSectionIDs("repeating_buff", function (ids) {
		//TAS.debug("pfbuffsrecalculate there are " + _.size(ids) + " rows and " + numColumns + " columns");
		try {
			if (_.size(ids) > 0) {
				_.each(buffColumns, function (col) {
					recalculateBuffColumn(ids, col);
				});
			} else {
				clearBuffTotals(done);
			}
		} catch (err) {
			TAS.error("PFBuffs.recalculate_recalcbuffs", err);
			//what to do? just quit
			done();
		}
	});
}
function registerEventHandlers () {
	//BUFFS
	_.each(buffColumns, function (col) {
		//Evaluate macro text upon change
		var prefix = "change:repeating_buff:buff-" + col ;
		on(prefix + "_macro-text", TAS.callback(function eventBuffMacroText(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " for column " + col + ", event: " + eventInfo.sourceType);
			setBuff(null, col);
		}));
		//Update total for a buff upon Mod change
		on(prefix, TAS.callback(function PFBuffs_updateBuffRowVal(eventInfo) {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "sheetworker" || (/size/i).test(eventInfo.sourceAttribute) ) {
				updateBuffTotals(col);
			}
		}));
		on(prefix + "-show", TAS.callback(function PFBuffs_updateBuffRowShowBuff(eventInfo) {
			var id;
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			if (eventInfo.sourceType === "player" || eventInfo.sourceType ==="api") {
				id = SWUtils.getRowId(eventInfo.sourceAttribute)||'';
				updateBuffTotals(col);
			}
		}));
	});
	//size is special users modify it via dropdown
	on("change:repeating_buff:buff-size", TAS.callback(function PFBuffs_updateBuffSize(eventInfo) {
		if (eventInfo.sourceType === "player" || eventInfo.sourceType ==="api") {
			TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
			updateBuffTotals('size');
		}
	}));	
	on("change:repeating_buff:buff-enable_toggle remove:repeating_buff", TAS.callback(function PFBuffs_updateBuffTotalsToggle(eventInfo) {
		TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
		if (eventInfo.sourceType === "player" || eventInfo.sourceType ==="api") {
			_.each(buffColumns, function (col) {
				updateBuffTotals(col);
			});
		}
	}));
	//generic easy buff total updates
	_.each(events.buffTotalNonAbilityEvents, function (functions, col) {
		var eventToWatch = "change:buff_" + col + "-total";
		_.each(functions, function (methodToCall) {
			on(eventToWatch, TAS.callback(function event_updateBuffNonAbilityEvents(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				if (eventInfo.sourceType === "sheetworker") {
					methodToCall(col, eventInfo);
				}
			}));
		});
	});
	_.each(events.buffTotalAbilityEvents, function (functions, col) {
		var eventToWatch = "change:buff_" + col + "-total change:buff_" + col + "-total_penalty";
		_.each(functions, function (methodToCall) {
			on(eventToWatch, TAS.callback(function event_updateBuffAbilityEvents(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				if (eventInfo.sourceType === "sheetworker") {
					methodToCall(col, eventInfo);
				}
			}));
		});
	});
	_.each(events.buffTotalEventsNoParam, function (functions, col) {
		var eventToWatch = "change:buff_" + col + "-total";
		_.each(functions, function (methodToCall) {
			on(eventToWatch, TAS.callback(function eventBuffTotalNoParam(eventInfo) {
				TAS.debug("caught " + eventInfo.sourceAttribute + " event: " + eventInfo.sourceType);
				if (eventInfo.sourceType === "sheetworker") {
					methodToCall(null,false, eventInfo);
				}
			}));
		});
	});
}
registerEventHandlers();
PFConsole.log('   PFBuffs module loaded          ');
PFLog.modulecount++;
