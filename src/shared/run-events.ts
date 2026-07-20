import { hashStringToSeed } from './rng';
import { MAX_GUARD_TOKENS, MAX_LIVES, type RunState } from './contracts';
import { gainRunInventoryItem } from './run-inventory';

export type RunEventId =
    | 'lost_cache'
    | 'mirror_bargain'
    | 'quiet_lantern'
    | 'sealed_keyring'
    | 'cracked_altar'
    | 'trap_survey'
    | 'echoing_index'
    | 'patrol_diary'
    | 'forgotten_names'
    | 'glass_mnemonic'
    | 'palimpsest_stair'
    | 'moth_eaten_map'
    | 'oath_ledger'
    | 'drowned_bell'
    | 'paper_tide'
    | 'ashen_portrait'
    | 'soot_black_cabinet'
    | 'whisper_vault'
    | 'mnemonic_well'
    | 'candle_census'
    | 'inverted_planetarium'
    | 'salt_archive'
    | 'hourglass_orrery'
    | 'blank_chorus'
    | 'breath_index'
    | 'threadbare_scriptorium';
export type RunEventChoiceEffect =
    | 'gain_shop_gold'
    | 'gain_relic_favor'
    | 'heal_or_guard'
    | 'gain_iron_key'
    | 'gain_destroy_charge'
    | 'gain_score'
    | 'skip';

export interface RunEventChoice {
    id: string;
    label: string;
    effect: RunEventChoiceEffect;
    detail: string;
    resultText?: string;
}

export interface RunEventDefinition {
    id: RunEventId;
    title: string;
    body: string;
    choices: readonly RunEventChoice[];
}

export type RunEventAtmosphereFamily =
    | 'archive_record'
    | 'echo_bargain'
    | 'rest_light'
    | 'key_memory'
    | 'relic_shrine'
    | 'trap_lore'
    | 'patrol_record'
    | 'memorial'
    | 'route_palimpsest'
    | 'sunken_chamber'
    | 'keeper_relic'
    | 'celestial_archive';

export interface RunEventAtmosphereProfile {
    family: RunEventAtmosphereFamily;
    roomCue: string;
}

export interface RunEventState extends RunEventDefinition {
    eventKey: string;
    runSeed: number;
    rulesVersion: number;
    floor: number;
    offlineOnly: true;
    options: readonly (RunEventChoice & { resultText: string })[];
}

export const RUN_EVENT_TABLE: readonly RunEventDefinition[] = [
    {
        id: 'lost_cache',
        title: 'Misfiled cache',
        body: 'A sealed satchel is cataloged under the wrong room number. Taking it can fund the vendor, but leaving the memory undisturbed keeps the route quiet.',
        choices: [
            {
                id: 'take_gold',
                label: 'Claim the satchel',
                effect: 'gain_shop_gold',
                detail: '+2 shop gold this run.',
                resultText: 'The satchel lands light, but the vendor will still count it.'
            },
            {
                id: 'leave_cache',
                label: 'Respect the index',
                effect: 'skip',
                detail: 'No change; safest for purist routing.',
                resultText: 'The wrong room number remains someone else\'s problem.'
            }
        ]
    },
    {
        id: 'mirror_bargain',
        title: 'Mirror bargain',
        body: 'A tarnished mirror repeats one future mistake before you make it. It offers relic momentum, but the reflection will not explain the route it came from.',
        choices: [
            {
                id: 'accept_favor',
                label: 'Accept the echo',
                effect: 'gain_relic_favor',
                detail: '+1 relic Favor progress.',
                resultText: 'The reflection nods a half-second before you do.'
            },
            {
                id: 'decline_mirror',
                label: 'Cover the mirror',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The covered mirror keeps its future mistake.'
            }
        ]
    },
    {
        id: 'quiet_lantern',
        title: 'Quiet lantern',
        body: 'A low lantern burns beside a bench of scratched recall marks. Rest here, and the next pattern feels less brittle.',
        choices: [
            {
                id: 'rest_light',
                label: 'Rest in the light',
                effect: 'heal_or_guard',
                detail: '+1 life if wounded; otherwise +1 guard token if uncapped.',
                resultText: 'The lantern steadies the scratches until they read like a warning.'
            },
            {
                id: 'press_on',
                label: 'Keep descending',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The lantern stays behind, small and patient.'
            }
        ]
    },
    {
        id: 'sealed_keyring',
        title: 'Sealed keyring',
        body: 'A brittle keyring hangs from a route marker with three erased exits. Breaking it makes noise, but one iron key still remembers its lock.',
        choices: [
            {
                id: 'break_keyring',
                label: 'Break the seal',
                effect: 'gain_iron_key',
                detail: '+1 iron key for dungeon locks.',
                resultText: 'The seal snaps, and one key keeps the shape of its door.'
            },
            {
                id: 'sell_keyring',
                label: 'Scrape the brass',
                effect: 'gain_shop_gold',
                detail: '+2 shop gold this run.',
                resultText: 'The brass flakes away into a vendor-ready handful.'
            },
            {
                id: 'leave_keyring',
                label: 'Leave it sealed',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The erased exits keep their key.'
            }
        ]
    },
    {
        id: 'cracked_altar',
        title: 'Cracked altar',
        body: 'The altar is split down the middle: one side hums with old Favor, the other holds a patient warding flame.',
        choices: [
            {
                id: 'take_favor',
                label: 'Draw Favor',
                effect: 'gain_relic_favor',
                detail: '+1 relic Favor progress.',
                resultText: 'Old Favor answers through the crack in the stone.'
            },
            {
                id: 'take_shelter',
                label: 'Take shelter',
                effect: 'heal_or_guard',
                detail: '+1 life if wounded; otherwise +1 guard token if uncapped.',
                resultText: 'The warding flame leans close enough to protect the next recall.'
            },
            {
                id: 'ignore_altar',
                label: 'Move on',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The altar keeps humming after you leave.'
            }
        ]
    },
    {
        id: 'trap_survey',
        title: 'Trap survey',
        body: 'Chalk diagrams map pressure plates to card positions. The notes can become tools, or you can study them for a cleaner route read.',
        choices: [
            {
                id: 'prep_tools',
                label: 'Build a breaker',
                effect: 'gain_destroy_charge',
                detail: '+1 destroy charge to the uncapped run bank.',
                resultText: 'The chalk becomes a compact answer to one bad pair.'
            },
            {
                id: 'study_marks',
                label: 'Memorize the chalk',
                effect: 'gain_score',
                detail: '+25 score.',
                resultText: 'The pressure plates line up cleanly in your head.'
            },
            {
                id: 'skip_marks',
                label: 'Leave the diagram',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The chalk dust waits for a less hurried reader.'
            }
        ]
    },
    {
        id: 'echoing_index',
        title: 'Echoing index',
        body: 'A shelf of nameplates whispers the last three rooms in the wrong order. Correcting the index would please the relic shrine; ignoring it preserves tempo.',
        choices: [
            {
                id: 'correct_index',
                label: 'Correct the index',
                effect: 'gain_relic_favor',
                detail: '+1 relic Favor progress.',
                resultText: 'The nameplates stop whispering over each other.'
            },
            {
                id: 'mark_margin',
                label: 'Mark the margin',
                effect: 'gain_score',
                detail: '+25 score.',
                resultText: 'Your margin mark gives the wrong order a useful edge.'
            },
            {
                id: 'close_index',
                label: 'Close the book',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The book shuts on three rooms that still disagree.'
            }
        ]
    },
    {
        id: 'patrol_diary',
        title: 'Patrol diary',
        body: 'A sentry diary lists yesterday\'s patrol turns in careful ticks. It is not a map, but it can make the next enemy read less surprising.',
        choices: [
            {
                id: 'pocket_diary',
                label: 'Pocket the diary',
                effect: 'heal_or_guard',
                detail: '+1 life if wounded; otherwise +1 guard token if uncapped.',
                resultText: 'The patrol ticks settle into a rhythm you can defend.'
            },
            {
                id: 'sell_binding',
                label: 'Sell the binding',
                effect: 'gain_shop_gold',
                detail: '+2 shop gold this run.',
                resultText: 'The binding pays better than the sentry\'s handwriting.'
            },
            {
                id: 'return_diary',
                label: 'Return it',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The diary remains exactly where its owner forgot it.'
            }
        ]
    },
    {
        id: 'forgotten_names',
        title: 'Forgotten names',
        body: 'A wall of erased adventurer names has one clear line left. Speaking it aloud may steady the run, or you can scrape the brass from the plaque.',
        choices: [
            {
                id: 'speak_name',
                label: 'Speak the name',
                effect: 'gain_relic_favor',
                detail: '+1 relic Favor progress.',
                resultText: 'The clear name holds long enough to answer you.'
            },
            {
                id: 'take_brass',
                label: 'Take the brass',
                effect: 'gain_shop_gold',
                detail: '+2 shop gold this run.',
                resultText: 'The brass comes free, leaving a darker rectangle behind.'
            },
            {
                id: 'walk_past',
                label: 'Walk past',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The last readable name fades back into the wall.'
            }
        ]
    },
    {
        id: 'glass_mnemonic',
        title: 'Glass mnemonic',
        body: 'A cracked glass tile repeats every symbol you almost remembered. Shattering it makes a useful tool; studying it banks a cleaner score line.',
        choices: [
            {
                id: 'shatter_glass',
                label: 'Shatter the tile',
                effect: 'gain_destroy_charge',
                detail: '+1 destroy charge to the uncapped run bank.',
                resultText: 'The broken glass keeps one sharp answer for later.'
            },
            {
                id: 'study_reflection',
                label: 'Study reflection',
                effect: 'gain_score',
                detail: '+25 score.',
                resultText: 'The reflection repeats the symbol until it finally sticks.'
            },
            {
                id: 'veil_glass',
                label: 'Veil it',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The veiled glass stops correcting your almost-memory.'
            }
        ]
    },
    {
        id: 'palimpsest_stair',
        title: 'Palimpsest stair',
        body: 'The stairwell has been written over so many times that old routes show through the stone. One clean tracing could steady the shrine, but a faster mark would preserve your pace.',
        choices: [
            {
                id: 'trace_old_route',
                label: 'Trace the old route',
                effect: 'gain_relic_favor',
                detail: '+1 relic Favor progress.',
                resultText: 'The rubbed route settles into the margin of your memory.'
            },
            {
                id: 'score_fresh_mark',
                label: 'Score a fresh mark',
                effect: 'gain_score',
                detail: '+25 score.',
                resultText: 'The new mark is crude, but it gives the floor a clean number to remember.'
            },
            {
                id: 'leave_layers',
                label: 'Leave the layers',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The stair keeps its overwritten directions.'
            }
        ]
    },
    {
        id: 'moth_eaten_map',
        title: 'Moth-eaten map',
        body: 'A cloth map hangs in a cracked case, its safest corridor eaten away. The remaining thread points toward a lock, while the brass frame could pay for the vendor.',
        choices: [
            {
                id: 'follow_thread',
                label: 'Follow the thread',
                effect: 'gain_iron_key',
                detail: '+1 iron key for dungeon locks.',
                resultText: 'The thread ends at a key notch you can still name.'
            },
            {
                id: 'strip_frame',
                label: 'Strip the frame',
                effect: 'gain_shop_gold',
                detail: '+2 shop gold this run.',
                resultText: 'The frame comes loose with a small, useful weight.'
            },
            {
                id: 'close_case',
                label: 'Close the case',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The map hangs quiet behind cracked glass.'
            }
        ]
    },
    {
        id: 'oath_ledger',
        title: 'Oath ledger',
        body: 'A ledger records promises made by explorers who reached this room before you. Signing beside them can brace the run; cutting out a blank page could fund supplies.',
        choices: [
            {
                id: 'sign_ledger',
                label: 'Sign the ledger',
                effect: 'heal_or_guard',
                detail: '+1 life if wounded; otherwise +1 guard token if uncapped.',
                resultText: 'The ink dries warm, and the next mistake feels less final.'
            },
            {
                id: 'take_blank_page',
                label: 'Take a blank page',
                effect: 'gain_shop_gold',
                detail: '+2 shop gold this run.',
                resultText: 'The blank page folds into spendable proof.'
            },
            {
                id: 'shut_ledger',
                label: 'Shut the ledger',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The ledger closes on everyone else\'s promises.'
            }
        ]
    },
    {
        id: 'drowned_bell',
        title: 'Drowned bell',
        body: 'A bell lies under black water, ringing only when you forget its shape. Raising it would make a breaker; listening to it would mark the floor in score.',
        choices: [
            {
                id: 'raise_bell',
                label: 'Raise the bell',
                effect: 'gain_destroy_charge',
                detail: '+1 destroy charge to the uncapped run bank.',
                resultText: 'The bell rises silent, heavy enough to break a false pair.'
            },
            {
                id: 'listen_below',
                label: 'Listen below',
                effect: 'gain_score',
                detail: '+25 score.',
                resultText: 'The sunken note gives the room a sharper outline.'
            },
            {
                id: 'leave_submerged',
                label: 'Leave it submerged',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The water swallows the bell before it can name you.'
            }
        ]
    },
    {
        id: 'paper_tide',
        title: 'Paper tide',
        body: 'Loose pages slide across the floor in a slow tide, carrying copied routes from rooms you have not reached. Binding them could reveal a lock pattern; weighing them down would leave spendable scraps.',
        choices: [
            {
                id: 'bind_pages',
                label: 'Bind the pages',
                effect: 'gain_iron_key',
                detail: '+1 iron key for dungeon locks.',
                resultText: 'The bound pages settle into the outline of a remembered key.'
            },
            {
                id: 'sell_scraps',
                label: 'Weigh the scraps',
                effect: 'gain_shop_gold',
                detail: '+2 shop gold this run.',
                resultText: 'The paper tide leaves enough marked scraps for the vendor.'
            },
            {
                id: 'let_tide_pass',
                label: 'Let it pass',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The pages slide on, carrying routes that may have been yours.'
            }
        ]
    },
    {
        id: 'ashen_portrait',
        title: 'Ashen portrait',
        body: 'A portrait of a forgotten keeper sheds ash whenever you look away. Brushing the frame can wake old Favor; studying the face can sharpen the room score.',
        choices: [
            {
                id: 'brush_frame',
                label: 'Brush the frame',
                effect: 'gain_relic_favor',
                detail: '+1 relic Favor progress.',
                resultText: 'Ash lifts from the frame, and old Favor recognizes the gesture.'
            },
            {
                id: 'study_face',
                label: 'Study the face',
                effect: 'gain_score',
                detail: '+25 score.',
                resultText: 'The keeper face fixes in memory just long enough to score.'
            },
            {
                id: 'turn_portrait',
                label: 'Turn it to the wall',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The portrait faces stone, shedding ash where no one counts it.'
            }
        ]
    },
    {
        id: 'soot_black_cabinet',
        title: 'Soot-black cabinet',
        body: 'A cabinet of charred drawers ticks softly as if sorting memories by heat. One drawer holds a lock-shaped imprint; another hides shop gold under a layer of ash.',
        choices: [
            {
                id: 'open_lock_drawer',
                label: 'Open the lock drawer',
                effect: 'gain_iron_key',
                detail: '+1 iron key for dungeon locks.',
                resultText: 'The drawer exhales soot around a key that still remembers a door.'
            },
            {
                id: 'sweep_coin_drawer',
                label: 'Sweep the coin drawer',
                effect: 'gain_shop_gold',
                detail: '+2 shop gold this run.',
                resultText: 'Ash stains your fingers, but the vendor will count what remains.'
            },
            {
                id: 'close_cabinet',
                label: 'Close it gently',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The cabinet resumes sorting memories you were not ready to claim.'
            }
        ]
    },
    {
        id: 'whisper_vault',
        title: 'Whisper vault',
        body: 'A narrow vault repeats your last mismatch in three careful voices. Silencing one voice can earn Favor, while copying the cadence turns the mistake into a score mark.',
        choices: [
            {
                id: 'silence_first_voice',
                label: 'Silence one voice',
                effect: 'gain_relic_favor',
                detail: '+1 relic Favor progress.',
                resultText: 'One whisper folds itself into the relic shrine and leaves the route quieter.'
            },
            {
                id: 'copy_cadence',
                label: 'Copy the cadence',
                effect: 'gain_score',
                detail: '+25 score.',
                resultText: 'The repeated mismatch becomes a measured mark instead of a lapse.'
            },
            {
                id: 'leave_vault',
                label: 'Leave it echoing',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The vault keeps your old mistake in circulation.'
            }
        ]
    },
    {
        id: 'mnemonic_well',
        title: 'Mnemonic well',
        body: 'A dry well is lined with tiles showing pairs you almost found. Dropping a token steadies the next recall; prying up a loose tile makes a breaker.',
        choices: [
            {
                id: 'drop_token',
                label: 'Drop a token',
                effect: 'heal_or_guard',
                detail: '+1 life if wounded; otherwise +1 guard token if uncapped.',
                resultText: 'The well returns no sound, only a steadier room log.'
            },
            {
                id: 'pry_tile',
                label: 'Pry up a tile',
                effect: 'gain_destroy_charge',
                detail: '+1 destroy charge to the uncapped run bank.',
                resultText: 'The loose tile comes free with one clean answer still carved beneath it.'
            },
            {
                id: 'keep_token',
                label: 'Keep walking',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The dry well keeps showing pairs from the corner of your eye.'
            }
        ]
    },
    {
        id: 'candle_census',
        title: 'Candle census',
        body: 'A clerk of melted wax has counted every candle that went out in this room. Correcting the tally can brace the run, but pocketing the brass tags would spend better.',
        choices: [
            {
                id: 'correct_census',
                label: 'Correct the tally',
                effect: 'heal_or_guard',
                detail: '+1 life if wounded; otherwise +1 guard token if uncapped.',
                resultText: 'The corrected count steadies the dark between the cards.'
            },
            {
                id: 'pocket_tags',
                label: 'Pocket the tags',
                effect: 'gain_shop_gold',
                detail: '+2 shop gold this run.',
                resultText: 'The brass tags clink like tiny room numbers in your pouch.'
            },
            {
                id: 'spare_candles',
                label: 'Spare the candles',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The wax clerk keeps counting losses by candlelight.'
            }
        ]
    },
    {
        id: 'inverted_planetarium',
        title: 'Inverted planetarium',
        body: 'A ceiling map turns below your feet, each star pinned to a card you have not flipped. Aligning the route can please the shrine; scraping a fallen star buys time with the vendor.',
        choices: [
            {
                id: 'align_star_route',
                label: 'Align the route',
                effect: 'gain_relic_favor',
                detail: '+1 relic Favor progress.',
                resultText: 'The star route clicks into place, and the shrine remembers the pattern.'
            },
            {
                id: 'pocket_fallen_star',
                label: 'Pocket a fallen star',
                effect: 'gain_shop_gold',
                detail: '+2 shop gold this run.',
                resultText: 'The cold star chips into spendable metal before the ceiling notices.'
            },
            {
                id: 'leave_sky_turning',
                label: 'Leave the sky turning',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The planetarium keeps rotating under the next room number.'
            }
        ]
    },
    {
        id: 'salt_archive',
        title: 'Salt archive',
        body: 'Shelves of salt tablets preserve routes from flooded rooms. Rinsing one tablet reveals a key memory; tasting the edge sharpens the score but leaves the archive brittle.',
        choices: [
            {
                id: 'rinse_key_tablet',
                label: 'Rinse a key tablet',
                effect: 'gain_iron_key',
                detail: '+1 iron key for dungeon locks.',
                resultText: 'The salt runs clear around a key mark that still knows its door.'
            },
            {
                id: 'taste_score_edge',
                label: 'Taste the edge',
                effect: 'gain_score',
                detail: '+25 score.',
                resultText: 'The bitter route fixes itself in memory long enough to count.'
            },
            {
                id: 'seal_archive',
                label: 'Seal the shelf',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The salt archive dries back into unreadable white lines.'
            }
        ]
    },
    {
        id: 'hourglass_orrery',
        title: 'Hourglass orrery',
        body: 'Glass bulbs orbit a brass dial, spilling sand whenever a pair is almost remembered. Turning the dial can brace the run; breaking a bulb leaves one tool for a bad match.',
        choices: [
            {
                id: 'turn_brass_dial',
                label: 'Turn the dial',
                effect: 'heal_or_guard',
                detail: '+1 life if wounded; otherwise +1 guard token if uncapped.',
                resultText: 'The dial slows, and the next lapse feels easier to catch.'
            },
            {
                id: 'break_sand_bulb',
                label: 'Break a bulb',
                effect: 'gain_destroy_charge',
                detail: '+1 destroy charge to the uncapped run bank.',
                resultText: 'The spilled sand gathers into one precise answer for later.'
            },
            {
                id: 'let_sand_fall',
                label: 'Let it fall',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The orrery keeps measuring almost-remembered pairs.'
            }
        ]
    },
    {
        id: 'blank_chorus',
        title: 'Blank chorus',
        body: 'A choir book opens to pages where every note has been rubbed out. Humming the missing line can wake old Favor; copying the rests turns silence into a score mark.',
        choices: [
            {
                id: 'hum_missing_line',
                label: 'Hum the missing line',
                effect: 'gain_relic_favor',
                detail: '+1 relic Favor progress.',
                resultText: 'The missing line answers softly, and old Favor holds the note.'
            },
            {
                id: 'copy_the_rests',
                label: 'Copy the rests',
                effect: 'gain_score',
                detail: '+25 score.',
                resultText: 'The silent measures become a clean number in the room log.'
            },
            {
                id: 'close_choir_book',
                label: 'Close the book',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The blank chorus waits for someone willing to remember the tune.'
            }
        ]
    },
    {
        id: 'breath_index',
        title: 'Breath index',
        body: 'A wall index records every breath taken in the room, but one column is smudged where fear interrupted the count. Restoring the column can steady recall; scraping the brass tabs would spend cleanly.',
        choices: [
            {
                id: 'restore_breath_column',
                label: 'Restore the column',
                effect: 'heal_or_guard',
                detail: '+1 life if wounded; otherwise +1 guard token if uncapped.',
                resultText: 'The corrected breaths settle into a count you can carry into the next room.'
            },
            {
                id: 'scrape_brass_tabs',
                label: 'Scrape the tabs',
                effect: 'gain_shop_gold',
                detail: '+2 shop gold this run.',
                resultText: 'The brass tabs come loose with room numbers still etched along the edges.'
            },
            {
                id: 'leave_count_smudged',
                label: 'Leave the count',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The smudged column keeps breathing a half-step out of time.'
            }
        ]
    },
    {
        id: 'threadbare_scriptorium',
        title: 'Threadbare scriptorium',
        body: 'A scriptorium loom stitches old route notes into a fraying carpet. Pulling the right thread can reveal a key memory; cutting the wrong strand makes a breaker for later.',
        choices: [
            {
                id: 'pull_key_thread',
                label: 'Pull the key thread',
                effect: 'gain_iron_key',
                detail: '+1 iron key for dungeon locks.',
                resultText: 'The thread unravels into a lock pattern that still remembers its door.'
            },
            {
                id: 'cut_bad_strand',
                label: 'Cut the bad strand',
                effect: 'gain_destroy_charge',
                detail: '+1 destroy charge to the uncapped run bank.',
                resultText: 'The cut strand knots into one blunt answer for a false pair.'
            },
            {
                id: 'leave_loom_running',
                label: 'Leave the loom',
                effect: 'skip',
                detail: 'No change.',
                resultText: 'The loom keeps stitching routes you have not earned yet.'
            }
        ]
    }
] as const;

const eventIndexFor = (runSeed: number, rulesVersion: number, floor: number): number => {
    const seed = hashStringToSeed(`runEvent:${rulesVersion}:${runSeed}:${floor}`);
    return Math.abs(seed) % RUN_EVENT_TABLE.length;
};

export const generateRunEvent = ({
    runSeed,
    rulesVersion,
    floor
}: {
    runSeed: number;
    rulesVersion: number;
    floor: number;
}): RunEventState => {
    const def = RUN_EVENT_TABLE[eventIndexFor(runSeed, rulesVersion, floor)]!;
    return {
        ...def,
        options: def.choices.map((choice) => ({ ...choice, resultText: choice.resultText ?? choice.detail })),
        eventKey: `${rulesVersion}:${runSeed}:${floor}:${def.id}`,
        runSeed,
        rulesVersion,
        floor,
        offlineOnly: true
    };
};

export const rollRunEventRoom = generateRunEvent;

export interface RunEventPreviewState {
    shopGold: number;
    lives: number;
    relicFavorProgress: number;
    bonusRelicPicksNextOffer?: number;
    favorBonusRelicPicksNextOffer?: number;
    ironKeys?: number;
    totalScore?: number;
    currentLevelScore?: number;
    bestScore?: number;
    destroyPairCharges?: number;
    guardTokens?: number;
}

const nonNegativeEventCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const createRunEventPreviewState = (run: RunState): RunEventPreviewState => ({
    shopGold: nonNegativeEventCount(run.shopGold),
    lives: nonNegativeEventCount(run.lives),
    relicFavorProgress: nonNegativeEventCount(run.relicFavorProgress),
    bonusRelicPicksNextOffer: nonNegativeEventCount(run.bonusRelicPicksNextOffer),
    favorBonusRelicPicksNextOffer: nonNegativeEventCount(run.favorBonusRelicPicksNextOffer),
    ironKeys: Object.values(run.dungeonKeys).reduce((sum, count) => sum + nonNegativeEventCount(count), 0),
    totalScore: nonNegativeEventCount(run.stats.totalScore),
    currentLevelScore: nonNegativeEventCount(run.stats.currentLevelScore),
    bestScore: nonNegativeEventCount(run.stats.bestScore),
    destroyPairCharges: nonNegativeEventCount(run.destroyPairCharges),
    guardTokens: nonNegativeEventCount(run.stats.guardTokens)
});

export const chooseRunEventOption = (
    state: RunEventPreviewState,
    event: RunEventState,
    choiceId: string
): {
    applied: boolean;
    eventId: RunEventId;
    choiceId: string;
    next: RunEventPreviewState;
    reason?: 'missing_choice' | 'invalid_state';
} => {
    if (state.lives <= 0) {
        return { applied: false, eventId: event.id, choiceId, next: state, reason: 'invalid_state' };
    }
    const choice = event.options.find((item) => item.id === choiceId);
    if (!choice) {
        return { applied: false, eventId: event.id, choiceId, next: state, reason: 'missing_choice' };
    }
    let next = { ...state };
    if (choice.effect === 'gain_shop_gold') {
        next = { ...next, shopGold: nonNegativeEventCount(next.shopGold) + 2 };
    } else if (choice.effect === 'gain_relic_favor') {
        const total = nonNegativeEventCount(next.relicFavorProgress) + 1;
        const bonusPicks = Math.floor(total / 3);
        next = {
            ...next,
            bonusRelicPicksNextOffer: nonNegativeEventCount(next.bonusRelicPicksNextOffer) + bonusPicks,
            favorBonusRelicPicksNextOffer: nonNegativeEventCount(next.favorBonusRelicPicksNextOffer) + bonusPicks,
            relicFavorProgress: total % 3
        };
    } else if (choice.effect === 'heal_or_guard') {
        next =
            nonNegativeEventCount(next.lives) < MAX_LIVES
                ? { ...next, lives: nonNegativeEventCount(next.lives) + 1 }
                : { ...next, guardTokens: Math.min(MAX_GUARD_TOKENS, nonNegativeEventCount(next.guardTokens) + 1) };
    } else if (choice.effect === 'gain_destroy_charge') {
        next = { ...next, destroyPairCharges: nonNegativeEventCount(next.destroyPairCharges) + 1 };
    } else if (choice.effect === 'gain_iron_key') {
        next = { ...next, ironKeys: nonNegativeEventCount(next.ironKeys) + 1 };
    } else if (choice.effect === 'gain_score') {
        const totalScore = nonNegativeEventCount(next.totalScore) + 25;
        next = {
            ...next,
            totalScore,
            currentLevelScore: nonNegativeEventCount(next.currentLevelScore) + 25,
            bestScore: Math.max(nonNegativeEventCount(next.bestScore), totalScore)
        };
    }
    return { applied: true, eventId: event.id, choiceId, next };
};

export interface RunEventResolution {
    run: RunState;
    applied: boolean;
    reason?: 'missing_choice' | 'invalid_state';
}

export interface RunEventCatalogRow {
    id: RunEventId;
    title: string;
    family: RunEventAtmosphereFamily;
    roomCue: string;
    conditionText: string;
    choiceCount: number;
    choices: Array<Pick<RunEventChoice, 'id' | 'label' | 'effect' | 'detail'> & { outcomeText: string }>;
}

export interface RunEventToneAuditRow {
    id: RunEventId;
    title: string;
    family: RunEventAtmosphereFamily;
    roomCue: string;
    memoryAnchors: string[];
    mechanicalChoiceCount: number;
    outcomeTextCount: number;
    toneReady: boolean;
}

export const RUN_EVENT_ATMOSPHERE_PROFILES: Record<RunEventId, RunEventAtmosphereProfile> = {
    lost_cache: {
        family: 'archive_record',
        roomCue: 'Misfiled shelves and wrong room numbers make treasure feel like an archival mistake.'
    },
    mirror_bargain: {
        family: 'echo_bargain',
        roomCue: 'A tarnished reflection repeats memory before the player commits to it.'
    },
    quiet_lantern: {
        family: 'rest_light',
        roomCue: 'Low light and scratched recall marks give recovery a physical place in the dungeon.'
    },
    sealed_keyring: {
        family: 'key_memory',
        roomCue: 'Keys remember erased exits, keeping lock rewards tied to route identity.'
    },
    cracked_altar: {
        family: 'relic_shrine',
        roomCue: 'Old Favor and warding flame split the shrine between ambition and safety.'
    },
    trap_survey: {
        family: 'trap_lore',
        roomCue: 'Chalk pressure-plate diagrams make trap knowledge feel studied, not arbitrary.'
    },
    echoing_index: {
        family: 'archive_record',
        roomCue: 'Whispering nameplates turn room order into an unstable memory problem.'
    },
    patrol_diary: {
        family: 'patrol_record',
        roomCue: 'Tick-marked patrol notes make enemy movement readable as remembered routine.'
    },
    forgotten_names: {
        family: 'memorial',
        roomCue: 'Erased adventurer names make Favor feel like restoring one surviving line.'
    },
    glass_mnemonic: {
        family: 'echo_bargain',
        roomCue: 'Cracked glass repeats almost-remembered symbols until the player chooses value or silence.'
    },
    palimpsest_stair: {
        family: 'route_palimpsest',
        roomCue: 'Overwritten stair routes show older paths under the current descent.'
    },
    moth_eaten_map: {
        family: 'key_memory',
        roomCue: 'Missing cloth corridors and surviving thread point toward locks and spendable frames.'
    },
    oath_ledger: {
        family: 'memorial',
        roomCue: 'Explorer promises make recovery feel witnessed by earlier failed descents.'
    },
    drowned_bell: {
        family: 'sunken_chamber',
        roomCue: 'Black water and a silent bell turn forgotten shape into tool or score.'
    },
    paper_tide: {
        family: 'route_palimpsest',
        roomCue: 'Copied route pages slide through the room before their destination is known.'
    },
    ashen_portrait: {
        family: 'keeper_relic',
        roomCue: 'A forgotten keeper portrait sheds ash whenever attention slips.'
    },
    soot_black_cabinet: {
        family: 'archive_record',
        roomCue: 'Charred drawers sort memories by heat and hide practical rewards in the soot.'
    },
    whisper_vault: {
        family: 'echo_bargain',
        roomCue: 'A narrow vault repeats the last mismatch until the player turns it into Favor or score.'
    },
    mnemonic_well: {
        family: 'sunken_chamber',
        roomCue: 'A dry well lined with almost-pairs makes recovery and breakers feel carved from recall.'
    },
    candle_census: {
        family: 'archive_record',
        roomCue: 'A wax tally of spent candles gives darkness a clerk and a count.'
    },
    inverted_planetarium: {
        family: 'celestial_archive',
        roomCue: 'A reversed star map ties route choice to remembered card positions and shrine value.'
    },
    salt_archive: {
        family: 'celestial_archive',
        roomCue: 'Salt-preserved route tablets turn flooded memory into keys, score, or restraint.'
    },
    hourglass_orrery: {
        family: 'celestial_archive',
        roomCue: 'Orbiting glass and falling sand make almost-remembered pairs feel timed and fragile.'
    },
    blank_chorus: {
        family: 'celestial_archive',
        roomCue: 'Erased music turns silence into Favor, score, or a deliberately untouched memory.'
    },
    breath_index: {
        family: 'archive_record',
        roomCue: 'A counted-breath ledger makes recovery feel like restoring order to a frightened room.'
    },
    threadbare_scriptorium: {
        family: 'route_palimpsest',
        roomCue: 'A fraying route loom ties keys and breakers to memories stitched into the floor.'
    }
};

const RUN_EVENT_MEMORY_ANCHORS = [
    'archive',
    'bell',
    'cache',
    'cabinet',
    'candle',
    'chalk',
    'diary',
    'door',
    'echo',
    'favor',
    'glass',
    'index',
    'key',
    'keeper',
    'lantern',
    'ledger',
    'map',
    'memory',
    'mnemonic',
    'mirror',
    'name',
    'patrol',
    'room',
    'route',
    'shrine',
    'stair',
    'symbol',
    'vault',
    'well'
] as const;

const eventCopyForToneAudit = (event: RunEventDefinition): string =>
    [
        event.title,
        event.body,
        ...event.choices.flatMap((choice) => [choice.label, choice.detail, choice.resultText ?? ''])
    ].join(' ').toLowerCase();

export const getRunEventCatalogRows = (): RunEventCatalogRow[] =>
    RUN_EVENT_TABLE.map((event) => {
        const atmosphere = RUN_EVENT_ATMOSPHERE_PROFILES[event.id];
        return {
            id: event.id,
            title: event.title,
            family: atmosphere.family,
            roomCue: atmosphere.roomCue,
            conditionText: 'Seed-stable local event room; selected by run seed, rules version, and floor.',
            choiceCount: event.choices.length,
            choices: event.choices.map((choice) => ({
                id: choice.id,
                label: choice.label,
                effect: choice.effect,
                detail: choice.detail,
                outcomeText: choice.resultText ?? choice.detail
            }))
        };
    });

export const getRunEventToneAuditRows = (): RunEventToneAuditRow[] =>
    RUN_EVENT_TABLE.map((event) => {
        const atmosphere = RUN_EVENT_ATMOSPHERE_PROFILES[event.id];
        const copy = eventCopyForToneAudit(event);
        const memoryAnchors = RUN_EVENT_MEMORY_ANCHORS.filter((anchor) => copy.includes(anchor));
        const mechanicalChoiceCount = event.choices.filter((choice) => choice.effect !== 'skip').length;
        const outcomeTextCount = event.choices.filter((choice) => (choice.resultText ?? '').length > 0).length;
        return {
            id: event.id,
            title: event.title,
            family: atmosphere.family,
            roomCue: atmosphere.roomCue,
            memoryAnchors,
            mechanicalChoiceCount,
            outcomeTextCount,
            toneReady:
                memoryAnchors.length > 0 &&
                mechanicalChoiceCount > 0 &&
                outcomeTextCount === event.choices.length &&
                atmosphere.roomCue.length > 0
        };
    });

const gainOneFavor = (run: RunState): RunState => {
    const total = nonNegativeEventCount(run.relicFavorProgress) + 1;
    const bonusPicks = Math.floor(total / 3);
    return {
        ...run,
        bonusRelicPicksNextOffer: nonNegativeEventCount(run.bonusRelicPicksNextOffer) + bonusPicks,
        favorBonusRelicPicksNextOffer: nonNegativeEventCount(run.favorBonusRelicPicksNextOffer) + bonusPicks,
        relicFavorProgress: total % 3
    };
};

const gainRunScoreReward = (run: RunState): RunState => {
    const totalScore = nonNegativeEventCount(run.stats.totalScore) + 25;
    return {
        ...run,
        stats: {
            ...run.stats,
            totalScore,
            currentLevelScore: nonNegativeEventCount(run.stats.currentLevelScore) + 25,
            bestScore: Math.max(nonNegativeEventCount(run.stats.bestScore), totalScore)
        }
    };
};

export const applyRunEventChoice = (
    run: RunState,
    event: RunEventState,
    choiceId: string
): RunEventResolution => {
    if (run.lives <= 0 || run.status === 'gameOver') {
        return { run, applied: false, reason: 'invalid_state' };
    }
    const choice = event.choices.find((item) => item.id === choiceId);
    if (!choice) {
        return { run, applied: false, reason: 'missing_choice' };
    }
    switch (choice.effect) {
        case 'gain_shop_gold':
            return { run: { ...run, shopGold: nonNegativeEventCount(run.shopGold) + 2 }, applied: true };
        case 'gain_relic_favor':
            return { run: gainOneFavor(run), applied: true };
        case 'heal_or_guard':
            if (nonNegativeEventCount(run.lives) < MAX_LIVES) {
                return { run: { ...run, lives: nonNegativeEventCount(run.lives) + 1 }, applied: true };
            }
            return { run: gainRunInventoryItem(run, 'guard_token'), applied: true };
        case 'gain_iron_key':
            return { run: gainRunInventoryItem(run, 'iron_key'), applied: true };
        case 'gain_destroy_charge':
            return { run: gainRunInventoryItem(run, 'destroy_charge'), applied: true };
        case 'gain_score':
            return { run: gainRunScoreReward(run), applied: true };
        case 'skip':
        default:
            return { run, applied: true };
    }
};
