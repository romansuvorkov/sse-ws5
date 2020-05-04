const http = require('http');
const Koa = require('koa');
const Router = require('koa-router');
const { streamEvents } = require('http-event-stream');
const koaBody = require('koa-body');
const uuid = require('uuid');
const WS = require('ws');
const app = new Koa();

app.use(async (ctx, next) => {
  const origin = ctx.request.get('Origin');
  if (!origin) {
    return await next();
  }

  const headers = { 'Access-Control-Allow-Origin': '*', };

  if (ctx.request.method !== 'OPTIONS') {
    ctx.response.set({ ...headers });
    try {
      return await next();
    } catch (e) {
      e.headers = { ...e.headers, ...headers };
      throw e;
    }
  }

  if (ctx.request.get('Access-Control-Request-Method')) {
    ctx.response.set({
      ...headers,
      'Access-Control-Allow-Methods': 'GET, POST, PUD, DELETE, PATCH',
    });

    if (ctx.request.get('Access-Control-Request-Headers')) {
      ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
    }

    ctx.response.status = 204;
  }
});

app.use(koaBody({
  text: true,
  urlencoded: true,
  multipart: true,
  json: true,
}));

const router = new Router();
const server = http.createServer(app.callback())
const wsServer = new WS.Server({ server });
const port = process.env.PORT || 7070;
server.listen(port);
app.use(router.routes()).use(router.allowedMethods());

const instances = [];

router.get('/instances', async (ctx, next) => {
  console.log('get index');
  ctx.response.body = instances;
  console.log(instances);
});

router.post('/instances', async (ctx, next) => {
  console.log('add inst');
  const id = uuid.v4();
  let startMessage = JSON.stringify({
      type: 'server log',
      id: id,
      msg: 'Received "Create command"',
      date: new Date(),
    });
    [...wsServer.clients]
    .filter(o => {
      return o.readyState === WS.OPEN;
    })
    .forEach(o => o.send(startMessage));

  setTimeout(() => {
    instances.push({
      id,
      state: 'stopped',
    });
    let createMessage = JSON.stringify({
      type: 'server log',
      id: id,
      msg: 'Created',
      date: new Date(),
    });
    [...wsServer.clients]
    .filter(o => {
      return o.readyState === WS.OPEN;
    })
    .forEach(o => o.send(createMessage));
  }, 1000);

  ctx.response.body = {
    status: 'ok'
  };
  console.log(instances);
});

router.patch('/instances/:id', async (ctx, next) => {
  let inputId = ctx.params.id;
  let changeMessage = JSON.stringify({
    type: 'server log',
    id: inputId,
    msg: 'Received "Change State"',
    date: new Date(),
  });
  [...wsServer.clients]
  .filter(o => {
    return o.readyState === WS.OPEN;
  })
  .forEach(o => o.send(changeMessage));

  const targetIndex = instances.findIndex((item) => item.id === inputId);
  if (targetIndex !== -1) {

    setTimeout(() => {
      let activeState = instances[targetIndex].state;
      if(activeState === 'stopped') {
        activeState = 'started';
      } else {
        activeState = 'stopped';
      }
      instances[targetIndex].state = activeState;

      let changeConfirm = JSON.stringify({
        type: 'server log',
        id: inputId,
        msg: activeState,
        date: new Date(),
      });
      [...wsServer.clients]
      .filter(o => {
        return o.readyState === WS.OPEN;
      })
      .forEach(o => o.send(changeConfirm));
    }, 1000);
  };
  ctx.response.body = {
    status: 'ok'
  }
  console.log(instances);
});

router.delete('/instances/:id', async (ctx, next) => {
  const inputId = ctx.params.id;
  const targetIndex =  instances.findIndex((item) => item.id === inputId);
  if (targetIndex !== -1) {
    let deleteRequest = JSON.stringify({
      type: 'server log',
      id: inputId,
      msg: 'Received "Delete instance"',
      date: new Date(),
    });
    [...wsServer.clients]
    .filter(o => {
      return o.readyState === WS.OPEN;
    })
    .forEach(o => o.send(deleteRequest));

    setTimeout(() => {
      instances.splice(targetIndex, 1);
      let deleteConfirm = JSON.stringify({
        type: 'server log',
        id: inputId,
        msg: 'Deleted',
        date: new Date(),
      });
      [...wsServer.clients]
      .filter(o => {
        return o.readyState === WS.OPEN;
      })
      .forEach(o => o.send(deleteConfirm));
    }, 1000);
  };
  ctx.response.body = {
    status: 'ok'
  }
  console.log(instances);
});

wsServer.on('connection', (ws, req) => {
  console.log('connection');
  ws.on('message', msg => {
    console.log('msg');
    [...wsServer.clients]
    .filter(o => {
      return o.readyState === WS.OPEN;
    })
    .forEach(o => o.send(msg));
  });
  ws.on('close', msg => {
    console.log('close');
  });
  ws.on('change', msg => {
    console.log('change');
  });
});
