import dbInit, { ITestDb } from '../helpers/database-init';
import getLogger from '../../fixtures/no-logger';
import { createTestConfig } from '../../config/test-config';
import { GroupService } from '../../../lib/services/group-service';
import GroupStore from '../../../lib/db/group-store';
import { EventService } from '../../../lib/services';

let stores;
let db: ITestDb;

let eventService: EventService;
let groupService: GroupService;
let groupStore: GroupStore;
let user;

beforeAll(async () => {
    db = await dbInit('group_service_serial', getLogger);
    stores = db.stores;
    user = await stores.userStore.insert({
        name: 'Some Name',
        email: 'test@getunleash.io',
    });
    const config = createTestConfig({
        getLogger,
    });
    eventService = new EventService(stores, config);
    groupService = new GroupService(stores, config, eventService);
    groupStore = stores.groupStore;

    await stores.groupStore.create({
        name: 'dev_group',
        description: 'dev_group',
        mappingsSSO: ['dev'],
    });
    await stores.groupStore.create({
        name: 'maintainer_group',
        description: 'maintainer_group',
        mappingsSSO: ['maintainer'],
    });

    await stores.groupStore.create({
        name: 'admin_group',
        description: 'admin_group',
        mappingsSSO: ['admin'],
    });
});

afterAll(async () => {
    await db.destroy();
});

afterEach(async () => {});

test('should have three group', async () => {
    const project = await groupService.getAll();
    expect(project.length).toBe(3);
});

test('should add person to 2 groups', async () => {
    await groupService.syncExternalGroups(
        user.id,
        ['dev', 'maintainer'],
        'SSO',
    );
    const groups = await groupService.getGroupsForUser(user.id);
    expect(groups.length).toBe(2);
});

test('should remove person from one group', async () => {
    await groupService.syncExternalGroups(user.id, ['maintainer'], 'SSO');
    const groups = await groupService.getGroupsForUser(user.id);
    expect(groups.length).toBe(1);
    expect(groups[0].name).toEqual('maintainer_group');
});

test('should add person to completely new group with new name', async () => {
    await groupService.syncExternalGroups(user.id, ['dev'], 'SSO');
    const groups = await groupService.getGroupsForUser(user.id);
    expect(groups.length).toBe(1);
    expect(groups[0].name).toEqual('dev_group');
});

test('should not update groups when not string array ', async () => {
    await groupService.syncExternalGroups(user.id, 'Everyone' as any, 'SSO');
    const groups = await groupService.getGroupsForUser(user.id);
    expect(groups.length).toBe(1);
    expect(groups[0].name).toEqual('dev_group');
});

test('should clear groups when empty array ', async () => {
    await groupService.syncExternalGroups(user.id, [], 'SSO');
    const groups = await groupService.getGroupsForUser(user.id);
    expect(groups.length).toBe(0);
});

test('should not remove user from no SSO definition group', async () => {
    const group = await groupStore.create({
        name: 'no_mapping_group',
        description: 'no_mapping_group',
    });
    await groupStore.addUserToGroups(user.id, [group.id]);
    await groupService.syncExternalGroups(user.id, [], 'SSO');
    const groups = await groupService.getGroupsForUser(user.id);
    expect(groups.length).toBe(1);
    expect(groups[0].name).toEqual('no_mapping_group');
});

test('adding a root role to a group with a project role should not fail', async () => {
    const group = await groupStore.create({
        name: 'root_group',
        description: 'root_group',
    });

    await stores.accessStore.addGroupToRole(group.id, 1, 'test', 'default');

    const updatedGroup = await groupService.updateGroup(
        {
            id: group.id!,
            name: group.name,
            users: [],
            rootRole: 1,
            createdAt: new Date(),
            createdBy: 'test',
        },
        'test',
    );

    expect(updatedGroup).toMatchObject({
        description: group.description,
        id: group.id,
        mappingsSSO: [],
        name: group.name,
        rootRole: 1,
    });

    expect.assertions(1);
});

test('adding a nonexistent role to a group should fail', async () => {
    const group = await groupStore.create({
        name: 'root_group',
        description: 'root_group',
    });

    await expect(() => {
        return groupService.updateGroup(
            {
                id: group.id,
                name: group.name,
                users: [],
                rootRole: 100,
                createdAt: new Date(),
                createdBy: 'test',
            },
            'test',
        );
    }).rejects.toThrow(
        'Request validation failed: your request body or params contain invalid data: Incorrect role id 100',
    );
});
