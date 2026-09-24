import { normalizeSaveData } from '../../shared/save-data';
import { testHallRoom, TEST_HALL_ROOMS, type TestHallRoomId } from '../../shared/test-hall-rooms';
import { useAppStore } from '../store/useAppStore';

/**
 * Loading a test hall room into the live game (dev only).
 *
 * The same move `startFixture` makes for the playable-path fixtures: the room's run goes into the
 * store as it is, on the playing view, with every armed tool cleared. The profile is the player's
 * own with the first-run tour marked seen, so a room opens on the board rather than on the tour.
 */
export const TEST_HALL_ROOM_PARAM = 'hallRoom';

export const isTestHallRoomId = (value: unknown): value is TestHallRoomId =>
    TEST_HALL_ROOMS.some((hallRoom) => hallRoom.id === value);

export const startTestHallRoom = (id: TestHallRoomId): void => {
    const saveData = normalizeSaveData({ ...useAppStore.getState().saveData, onboardingDismissed: true });
    useAppStore.setState({
        view: 'playing',
        run: testHallRoom(id).build(),
        saveData,
        boardPinMode: false,
        peekModeArmed: false,
        tileSwapArmed: false,
        tileSwapFirstTileId: null,
        matchScorePop: null,
        mismatchScorePop: null
    });
};

/** The room the URL asks for (`/?hallRoom=bomb`), or `null`. */
export const testHallRoomFromUrl = (search: string = window.location.search): TestHallRoomId | null => {
    const value = new URLSearchParams(search).get(TEST_HALL_ROOM_PARAM);
    return isTestHallRoomId(value) ? value : null;
};
