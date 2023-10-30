const http = require("http");
const THREE = require("three");
const {arToolkitSource, arToolkitContext} = require("threex");
//const THREEx = require("threex");
const {createCanvas, loadImage} = require("canvas");

var renderer = require("gl")(640, 640);

const hostname = "127.0.0.1";
const port = 3000;
 
var loader = new THREE.TextureLoader();

var clock, deltaTime, totalTime;
//var arToolkitSource, arToolkitContext;
var camera, renderer, rend, mainScene, scene;
var emptyObj, vObj, vObjMask, light, origLight, shadowPlane, wPlane, dPlane;
var adjustX, adjustZ;
var contour, done = false;
var globalResult = "";

var ray    = new THREE.Raycaster();
var mouse  = new THREE.Vector2();
var loader = new THREE.TextureLoader();

var planeSize, sPlaneSize, sPlaneSegments, vObjHeight, vObjRatio;

initialize();

const server = http.createServer((req, res) =>
{
	res.statusCode = 200;
	res.setHeader("Content-Type", "text/plain");
	var canvas = createCanvas(200, 200);
	res.write("1");
	res.render("index.php", {name:name});
	res.end();
});

 
server.listen(port, hostname, () =>
{
	console.log(`Server running at http://${hostname}:${port}/`);
});


function onResize()
{
	arToolkitSource.onResizeElement()	
	arToolkitSource.copyElementSizeTo(renderer.domElement)	
	if ( arToolkitContext.arController !== null )
	{
		arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas)
	}
}


function initialize()
{
	/**********************************************************************************************
	 *
	 * Cenas e iluminação
	 *
	 *********************************************************************************************/

	mainScene = new THREE.Scene();

	// fov (degrees), aspect, near, far
	//camera = new THREE.PerspectiveCamera(32, 16.0 / 9.0, 1, 1000);
	//camera = new THREE.PerspectiveCamera(32, 1, 1, 1000);
	camera = new THREE.Camera();
	camera.isPerspectiveCamera = true; // enable ray casting
	mainScene.add(camera);
	new THREE.Scene().add(camera); // magically fixes camera and scene position, do not remove

	/**********************************************************************************************
	 *
	 * Renderers e canvas
	 *
	 *********************************************************************************************/
/*
	renderer = new THREE.WebGLRenderer({
		preserveDrawingBuffer: true,
		antialias: true,
		alpha: true
	});
	renderer.setClearColor(new THREE.Color('lightgrey'), 0);
	renderer.setSize(640, 640);
	renderer.domElement.style.position = 'absolute';
	renderer.domElement.style.top = '0px';
	renderer.domElement.style.left = '0px';
	renderer.shadowMap.enabled = true;*/
	//document.body.appendChild(renderer.domElement);

	clock = new THREE.Clock();
	deltaTime = 0;
	totalTime = 0;
	
	/**********************************************************************************************
	 *
	 * AR Toolkit
	 *
	 *********************************************************************************************/

	fetch("my-images/contour.txt")
		.then(response => response.text())
		.then(text => contour = text.split(" "))

	arToolkitSource = new THREEx.ArToolkitSource({
		//sourceType: 'webcam'
//		sourceType: 'image', sourceUrl: 'my-images/index.jpeg',
		sourceType: 'image', sourceUrl: 'my-images/frame.jpg',
//		sourceWidth: 640,
//		sourceHeight: 480,
//		displayWidth: 640,
//		displayHeight: 640
	});

	arToolkitSource.init(function onReady(){
		onResize()
	});

	// handle resize event
	window.addEventListener('resize', function(){
		onResize()
	});

	// create atToolkitContext
	arToolkitContext = THREE.ArToolkitContext({
		cameraParametersUrl: 'data/camera_para.dat',
		detectionMode: 'mono'
	});
	
	// copy projection matrix to camera when initialization complete
	arToolkitContext.init(function onCompleted(){
		camera.projectionMatrix.copy( arToolkitContext.getProjectionMatrix() );
		//camera.aspect = 1.0;
		//camera.updateProjectionMatrix();
	});


	/**********************************************************************************************
	 *
	 * Declaração de variáveis globais
	 *
	 *********************************************************************************************/

	planeSize      = 150.00;
	sPlaneSize     =  15.00;
	sPlaneSegments = 300.00;
	vObjHeight     =   1.20;
	vObjRatio      =   1.00;
	adjustX        =   0.00;
	adjustZ        =   0.00;

	/**********************************************************************************************
	 *
	 * Materiais e texturas
	 *
	 *********************************************************************************************/

	var wood = new THREE.MeshPhongMaterial({map: loader.load("my-textures/face/wood.png")});

	var maskMat = new THREE.MeshBasicMaterial({
		color: 0xffffff,
		side: THREE.DoubleSide
	});

	var shadowMat = new THREE.ShadowMaterial({
		opacity: 0.75,
		side: THREE.DoubleSide,
	});

	var lightMat = new THREE.MeshBasicMaterial({
		color: 0x000000,
		side: THREE.DoubleSide,
		opacity: 0.15
	});

	var darkMat = new THREE.MeshBasicMaterial({
		color: 0x000000,
		side: THREE.DoubleSide,
		opacity: 0.15
	});

	var blackMat = new THREE.MeshBasicMaterial({
		color: 0x000000,
		side: THREE.DoubleSide,
	});

	var rMat = new THREE.MeshBasicMaterial({
		color: 0xff0000,
		side: THREE.DoubleSide
	});

	var gMat = new THREE.MeshBasicMaterial({
		color: 0x00ff00,
		side: THREE.DoubleSide
	});

	var bMat = new THREE.MeshBasicMaterial({
		color: 0x0000ff,
		side: THREE.DoubleSide
	});

	var nMat = new THREE.MeshNormalMaterial({
		transparent: true,
		opacity: 0.5,
		side: THREE.DoubleSide
	});

	/**********************************************************************************************
	 *
	 * Cenas
	 *
	 *********************************************************************************************/

	scene = new THREE.Group();
	mainScene.add(scene);
	var markerControls1 = new THREEx.ArMarkerControls(arToolkitContext, scene, {
		type: 'pattern', patternUrl: "data/kanji.patt",
	});

	/**********************************************************************************************
	 *
	 * Iluminação
	 *
	 *********************************************************************************************/

	var ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
	origLight = new THREE.DirectionalLight(0xffffff);
	origLight.castShadow = true;
	var d = vObjRatio * vObjHeight * 40;
	origLight.shadow.camera.left   = -d;
	origLight.shadow.camera.right  =  d;
	origLight.shadow.camera.top    =  d;
	origLight.shadow.camera.bottom = -d;

	origLight.shadow.mapSize.width  = 4096;
	origLight.shadow.mapSize.height = 4096;

	light = origLight.clone();

//	var helper = new THREE.CameraHelper(light.shadow.camera);
//	scene.add(helper);

	/**********************************************************************************************
	 *
	 * Geometrias
	 *
	 *********************************************************************************************/

	var cube   = new THREE.BoxBufferGeometry(vObjHeight, vObjHeight * vObjRatio, vObjHeight);
	var plane  = new THREE.PlaneGeometry(planeSize, planeSize, 150, 150);
	var splane = new THREE.PlaneGeometry(sPlaneSize, sPlaneSize, sPlaneSegments, sPlaneSegments);

	/**********************************************************************************************
	 *
	 * Objetos 3D presentes nas cenas
	 *
	 *********************************************************************************************/

	emptyObj    = new THREE.Mesh();//new THREE.SphereGeometry(0.2), new THREE.MeshNormalMaterial());
	vObj        = new THREE.Mesh(cube,    wood);
	vObjMask    = new THREE.Mesh(cube,    maskMat);
	shadowPlane = new THREE.Mesh(splane,  shadowMat);
	wPlane      = new THREE.Mesh(plane,   maskMat);
	dPlane      = new THREE.Mesh(plane,   blackMat);

	/**********************************************************************************************
	 *
	 * Ajustes de posição, rotação, etc.
	 *
	 *********************************************************************************************/

	origLight.position.set(10 * vObjHeight, vObjRatio * vObjHeight / 2, vObjHeight / 2);
	light.position.set    (10 * vObjHeight, vObjRatio * vObjHeight / 2, vObjHeight / 2);
	vObj.position.set     (adjustX, vObjRatio * vObjHeight / 2, adjustZ);
	camera.position.set   (0, 9, 12);

	camera.lookAt(new THREE.Vector3(0, 0, 0));

	shadowPlane.receiveShadow = true;
	vObjMask.castShadow       = true;

	shadowPlane.rotation.x = -Math.PI / 2;
	shadowPlane.position.y = -0.05;
	wPlane.rotation.x = -Math.PI / 2;
	wPlane.position.y = shadowPlane.position.clone().y - 0.2;
	dPlane.rotation.x = -Math.PI / 2;
	dPlane.position.y = shadowPlane.position.clone().y - 0.2;

	/**********************************************************************************************
	 *
	 * Ajustes de posição e rotação
	 *
	 *********************************************************************************************/

	scene.add(ambientLight.clone());

	scene.add(vObj);
	scene.add(shadowPlane);
	scene.add(emptyObj);
	scene.add(light);

	scene.add(wPlane);
	scene.add(dPlane);
	scene.add(vObjMask);

	wPlane.visible       = false;
	dPlane.visible       = false;
	vObjMask.visible     = false;
	vObj.castShadow      = true;
}


function getMidPoints(p, t, r) // p: pontos, t: tolerancia, r: recursoes
{
	if (r > 0)
	{
		var v, k, n = p.length;
		for (var i = 0; i < n; i++)
		{
			for (var j = 0; j < n; j++)
			{
				if (i == j)
					continue;
				v = ((p[i].clone()).add(p[j].clone())).multiplyScalar(0.5);
				for (k = n; k < p.length; k++)
					if ((Math.abs(v.x - p[k].x) + Math.abs(v.y - p[k].y) + Math.abs(v.z - p[k].z)) < t)
						break;
				if (k == p.length)
					p.push(v.clone());
			}
		}
		return getMidPoints(p, t, --r);
	}
	return p;
}


function beginMethod(list, debug, threshold, rho, theta, alpha, recMax, subMax)
{
	console.log("Parameters:", alpha, recMax, subMax);

	var startTime = performance.now();
	var origOpacity = shadowPlane.material.opacity;
	shadowPlane.material.opacity = 1;

	var v1 = [];
	var v2 = [];
	var v3 = [];

	// adquire conjunto de pontos a partir dos vertices do objeto virtual
	var position = vObj.geometry.attributes.position;
	for (var i = 0; i < position.count; i++)
		v1.push(new THREE.Vector3().fromBufferAttribute(position, i));
	getMidPoints(v1, 0, 1);

	// adquire conjunto de pontos a partir dos triangulos da geometria
	var pos = vObj.geometry.toNonIndexed().attributes.position;
	for (var i = 0; i < pos.count; i += 3)
	{
		var t1 = new THREE.Vector3().fromBufferAttribute(pos, i);
		var t2 = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
		var t3 = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
		v1.push(new THREE.Vector3((t1.x + t2.x + t3.x) / 3, (t1.y + t2.y + t3.y) / 3, (t1.z + t2.z + t3.z) / 3));
	}

	// passa os pontos adquiridos para valores globais
	for (var i = 0; i < v1.length; i++)
	{
		v1[i].x += vObj.position.x;
		v1[i].y += vObj.position.y;
		v1[i].z += vObj.position.z;

		// elimina os pontos abaixo de 25% da altura do objeto virtual
		//if (v1[i].y < vObjHeight / 4)
		//	v1.splice(i--, 1);
/*
		if (debug)
		{
			var newObj = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0x0000ff }));
			newObj.position.set(v1[i].x, v1[i].y, v1[i].z);
			vDebug.push(newObj.clone());
		}
*/
	}

	//console.log("get floor points");

	var w    = renderer.domElement.clientWidth;
	var h    = renderer.domElement.clientHeight;
	var padw = (w > h) ? Math.floor((w - h) / 2.0) : 0;
	var padh = (h > w) ? Math.floor((h - w) / 2.0) : 0;
	var m    = ((w > h) ? h : w) / 256.0;

	// adquire conjunto de pontos a partir dos pontos 2d da sombra
	//v1 = [vObj.position];
	var k = 0;
	while (k < list.length)//2
	{
		x        = parseInt(list[k++]) * m + padw;
		y        = parseInt(list[k++]) * m + padh;
		mouse.x  =  (x / w) * 2 - 1;
		mouse.y  = -(y / h) * 2 + 1;

		ray.setFromCamera(mouse, camera);
		var i = ray.intersectObject(shadowPlane);
		if (i.length > 0)
			v2.push(new THREE.Vector3((i[0].uv.x - 0.5) * sPlaneSize + shadowPlane.position.x, shadowPlane.position.y, (0.5 - i[0].uv.y) * sPlaneSize + shadowPlane.position.z));
	}

	//console.log("shrink list");

	// reduz o tamanho da segunda lista
	if (threshold == -1)
		v2.splice(1);
	else
		for (var i = 0; i < v2.length - 1; i++)
			for (var j = i + 1; j < v2.length; j++)
				if (v2[i].distanceTo(v2[j]) < threshold)
					v2.splice(j--, 1);
	//console.log(v2.length);
/*
	if (debug)
	{
		for (var i = 0; i < v2.length; i++)
		{
			var newObj = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
			newObj.position.set(v2[i].x, v2[i].y, v2[i].z);
			vDebug.push(newObj.clone());
		}
	}
*/
	//console.log("combine");

	// liga os pontos
	for (var i = 0; i < v1.length; i++)
	{
		for (var j = 0; j < v2.length; j++)
		{
			var aux = v1[i].clone().sub(v2[j].clone());
			var v   = aux.clone().normalize().multiplyScalar(3 * vObjRatio * vObjHeight).add(v1[i].clone()); // quanto maior o escalar, mais longe fica a fonte de luz
			v3.push([v1[i], v2[j], v, aux, Math.atan2(aux.z, aux.x) * 180 / Math.PI + 180]);
		}
	}

	//console.log("sort");

	// ordena a lista
	v3.sort(function(a, b)
	{
		return a[4] - b[4];
	});

	//console.log("compare");
	var mask = [];
	for (var i = 0; i < 65536; i++)
		mask.push(1);
	for (var i = 0; i < list.length; i += 2)
		mask[parseInt(list[i]) + parseInt(list[i + 1]) * 256] = 0;

	rend = new THREE.WebGLRenderer({
		preserveDrawingBuffer: true,
		antialias: true
	});
	rend.setClearColor(new THREE.Color('white'), 0);
	rend.setSize(w, h);
	rend.shadowMap.enabled = true;

	light.visible = true;
	light.target = emptyObj;

	var mi = 0, mv = 0;

	for (k = 0; k < v3.length; k++)
	{
		var val = getRenderValue(v3[k][1], v3[k][2], mask);
		if (val > mv)
		{
			mv = val;
			mi = k;
		}
	}

	k = mi;

	light.position.set(v3[k][2].x, v3[k][2].y, v3[k][2].z);
	emptyObj.position.set(v3[k][1].x, v3[k][1].y, v3[k][1].z);

	var v5 = v3[k][2].clone().sub(v3[k][1]).normalize();
	alpha *= Math.PI / 180;

	var result = mainMethod(mask, mv, v5.normalize(), v3[k][1], alpha, alpha, origOpacity, debug, v3.length, rho, theta, subMax, recMax);
	var endTime = performance.now();
	var dt = endTime - startTime;
	var minutes = Math.floor(dt / 60000);
	var seconds = Math.floor((dt - minutes * 60000) / 1000);
	var miliseconds = dt - minutes * 60000 - seconds * 1000;
	console.log("00:" + (minutes > 9 ? "" : "0") + minutes + ":" + (seconds > 9 ? "" : "0") + seconds + "," + (miliseconds > 99 ? "" : (miliseconds > 9 ? "0" : "00")) +  + Math.round(miliseconds));
	done = true;
	return result;
}


function mainMethod(mask, mv, initialVector, objectPosition, alpha, opAlpha, origOpacity, debug, v3len, rho = 257, theta = 257, subMax = 1, recMax = 1, depth = 1)
{
	var v5 = initialVector.normalize();
	//console.log("Main method! Depth: " + depth.toString() + "; vector: [" + v5.x.toFixed(3) + ", " + v5.y.toFixed(3) + ", " + v5.z.toFixed(3) + "]; previous IoU: " + getRenderValue(objectPosition, v5.clone().multiplyScalar(5).add(objectPosition), mask).toFixed(5) + "; alpha: " + (alpha * 180 / Math.PI).toFixed(3));

	// cria o mapa
	//console.log("map");
	var ni = rho;
	var nj = theta;
	var si = alpha / ni;
	var sj = Math.PI * 2 / nj;
	var v7 = new THREE.Vector3(0, 1, 0).cross(v5);
	var v8 = v5.clone();
	var vl = [];
	var maxRenderVal = 0;
	var maxVec;// = v8.clone().multiplyScalar(5).add(objectPosition);
	for (var i = 0; i < ni; i++)
	{
		v8.applyAxisAngle(v7, si);
		//vl.push([Math.PI * (Math.pow((i + 1) * si / ni, 2) - Math.pow(i * si / ni, 2)) * (sj / nj) * 1000000000]);
		vl.push([]);
		for (var j = 0; j < nj; j++)
		{
			v8.applyAxisAngle(v5, sj);
			var v9 = v8.clone().multiplyScalar(5).add(objectPosition);
			var renderVal = getRenderValue(objectPosition, v9, mask);
			vl[i].push([v9, renderVal, (i / ni) * Math.cos(j * sj), (i / ni) * Math.sin(j * sj) * -1, 0]);
			if (renderVal > maxRenderVal)
			{
				maxVec = v9;
				maxRenderVal = renderVal;
			}
		}
	}

	// calcula a imagem integral
	//console.log("integral");
	vl[0][0][4] = vl[0][0][1];
	for (var i = 1; i < vl[0].length; i++)
		vl[0][i][4] = vl[0][i - 1][4] + vl[0][i][1];
	for (var i = 1; i < vl.length; i++)
	{
		vl[i][0][4] = vl[i - 1][0][4] + vl[i][0][1];
		for (var j = 1; j < vl[i].length; j++)
			vl[i][j][4] = vl[i][j][1] + vl[i][j - 1][4] + vl[i - 1][j][4] - vl[i - 1][j - 1][4];
	}

	// encontra o melhor ponto da calota esferica
	//console.log("cap");
	var div = false;
	var res = searchWithinCap(div, mv, mask, subMax, vl, si, sj, ni, nj, objectPosition, v5, debug, depth, recMax, alpha, opAlpha, alpha);
	var v6 = res[0].clone().multiplyScalar(5).add(objectPosition);
	light.position.set(v6.x, v6.y, v6.z);

	vObj.material.opacity = 0.75;
	vObj.material.transparent = true;

	if (debug)
		drawCap(vl, rho, theta, depth, recMax, 0, subMax, opAlpha);

	var newAlpha = alpha * 0.71167 / Math.pow(2, res[5]); // Math.sqrt(Math.pow(1 - Math.sqrt(Math.PI) / 4, 2) + Math.PI / 16) / tamanho_da_secao
	console.log("new alpha:", newAlpha * 180 / Math.PI);
	if (depth < recMax)
		mainMethod(mask, mv, res[0].clone(), objectPosition, newAlpha, opAlpha, origOpacity, debug, v3len, rho, theta, subMax, recMax, depth + 1);
	else
	{
		shadowPlane.material.opacity = origOpacity;
		var str = "";
		console.log("IoU: 0," + getRenderValue(objectPosition, res[0].clone().multiplyScalar(5).add(objectPosition), mask).toFixed(5).substring(2));
		return (res[0].x.toString() + " " + res[0].y.toString() + " " + res[0].z.toString());
	}
}


//
function searchWithinCap(extra, best, mask, subMax, map, ii, jj, ni, nj, ori, v0, debug, rec, maxRec, opAlpha, ogAlpha, alpha, beta = Math.PI, theta = 0, p0 = v0.clone(), prev = 0, depth = 1, path = [])
{
	//console.log("Searching cap! Depth: " + depth.toString() + "; vector: [" + p0.x.toFixed(3) + ", " + p0.y.toFixed(3) + ", " + p0.z.toFixed(3) + "]; previous best IoU: " + getRenderValue(ori, p0.clone().multiplyScalar(5).add(ori), mask).toFixed(5));
	var p = [];

	if (depth == 1)
	{
		var axis = new THREE.Vector3(0, 1, 0).cross(v0).normalize();
		for (var i = 0; i < 8; i++)
		{
			p.push(p0.clone().applyAxisAngle(axis, alpha / 2));
			p[i].applyAxisAngle(v0, i * Math.PI / 2 + Math.PI / (extra ? 8 : 4));
		}
	}
	else
	{
		var axis = v0.clone().cross(p0).normalize();
		for (var i = 0; i < (extra ? 8 : 4); i++)
			p.push(p0.clone());
		p[0].applyAxisAngle(axis,  alpha / 2);
		p[1].applyAxisAngle(axis, -alpha / 2);
		p[2].applyAxisAngle(axis, -alpha / 2);
		p[3].applyAxisAngle(axis,  alpha / 2);
		p[0].applyAxisAngle(v0,    beta  / 4);
		p[1].applyAxisAngle(v0,    beta  / 4);
		p[2].applyAxisAngle(v0,   -beta  / 4);
		p[3].applyAxisAngle(v0,   -beta  / 4);

		if (extra)
		{
			p[4].applyAxisAngle(v0,    beta  / 4);
			p[5].applyAxisAngle(axis, -alpha / 2);
			p[6].applyAxisAngle(v0,   -beta  / 4);
			p[7].applyAxisAngle(axis,  alpha / 2);
		}
	}

	var list = [];
	var res = [];
	var r0, r1, t0, t1, r0f, r1f, t0f, t1f;
	for (var i = 0; i < (extra ? 8 : 4); i++)
	{
		var val = 0;
		if (depth == 1)
		{
			r0 = 0;
			r1 = alpha;
			t0 = i * Math.PI / (extra ? 4 : 2);
			t1 = t0 + Math.PI / 2;
		}
		else
		{
			var rho = p[i].angleTo(v0);
			r0 = rho - alpha / 2;
			r1 = rho + alpha / 2;
			switch (i)
			{
				case 0:
				case 1:
				case 4:
					t0 = theta;
					t1 = theta + beta / 2;
					break;

				case 2:
				case 3:
				case 6:
					t0 = theta - beta / 2;
					t1 = theta;
					break;

				case 5:
					t0 = theta - beta / 4;
					t1 = theta + beta / 4;
					break;

				case 7:
					t0 = theta + beta / 4;
					t1 = theta - beta / 4;
					break;
			}
		}
		r0f = r0 / opAlpha;
		r1f = r1 / opAlpha;
		t0f = t0;
		t1f = t1;

		//var area = (r1 * r1 - r0 * r0) * Math.PI * (Math.abs(t1 - t0) / (2 * Math.PI));
		r0 = Math.round(r0 / ii);
		r1 = Math.round(r1 / ii);
		t0 = Math.round(t0 / jj);
		t1 = Math.round(t1 / jj);
		if (r0 < 0)
			r0 = 0;
		if (r1 < 1)
			r1 = 1;
		if (r0 > ni - 2)
			r0 = ni - 2;
		if (r1 > ni - 1)
			r1 = ni - 1;
		while (t0 < 0)
			t0 += nj;
		while (t1 < 0)
			t1 += nj;
		while (t0 >= nj)
			t0 -= nj;
		while (t1 >= nj)
			t1 -= nj;
		if (r0 == r1)
			r1++;
		if (t0 == t1)
		{
			if (t0 == nj - 1)
				t0--;
			else
				t1++;
		}
		var ar = Math.max(0, Math.min(Math.round((r0 + r1) / 2), ni - 1));
		var at = Math.max(0, Math.min(Math.round((t0 + t1) / 2) + (t0 > t1 ? nj / 2 : 0), nj - 1));

		var lMax = 0;
		if (t0 > t1)
		{
			for (var j = r0; j <= r1; j++)
			{
				for (var k = 0; k < t1; k++)
					lMax = Math.max(lMax, map[j][k][1]);//val += map[j][k][1];
				for (var k = t0 + 1; k < nj; k++)
					lMax = Math.max(lMax, map[j][k][1]);//val += map[j][k][1];
			}
		}
		else
			for (var j = r0; j <= r1; j++)
				for (var k = t0; k <= t1; k++)
					lMax = Math.max(lMax, map[j][k][1]);//val += map[j][k][1];
		res.push(lMax);
		r0--;
		if (t0 > t1)
		{
			t1--;
			var a, b, c, d, e, f;
			a = b = c = e = 0;
			if (r0 >= 0)
			{
				c = map[r0][t0][4];
				e = map[r0][nj - 1][4];
			}
			if (t1 >= 0)
				b = map[r1][t1][4];
			if (r0 >= 0 && t1 >= 0)
				a = map[r0][t1][4];
			d = map[r1][t0][4];
			f = map[r1][nj - 1][4];
			val = f - e - (d - b - c + a);
		}
		else
		{
			t0--;
			var a, b, c, d;
			a = b = c = e = 0;
			if (r0 >= 0)
				c = map[r0][t1][4];
			if (t0 >= 0)
				b = map[r1][t0][4];
			if (r0 >= 0 && t0 >= 0)
				a = map[r0][t0][4];
			d = map[r1][t1][4];
			val = d - b - c + a;
		}
		r0++;
		t0++;
		var mr, mt, cm = 0, area = 0;
		if (t0 > t1)
		{
			for (var j = r0; j <= r1; j++)
			{
				for (var k = 0; k < t1; k++)
				{
					area++;
					if (map[j][k][1] > cm)
					{
						cm = map[j][k][1];
						mr = j;
						mt = k;
					}
				}
				for (var k = t0 + 1; k < nj; k++)
				{
					area++;
					if (map[j][k][1] > cm)
					{
						cm = map[j][k][1];
						mr = j;
						mt = k;
					}
				}
			}
		}
		else
		{
			for (var j = r0; j <= r1; j++)
			{
				for (var k = t0; k <= t1; k++)
				{
					area++;
					if (map[j][k][1] > cm)
					{
						cm = map[j][k][1];
						mr = j;
						mt = k;
					}
				}
			}
		}
		list.push([p[i], val * lMax / area, i, ar, at, mr, mt, r0f, r1f, t0f, t1f]);
		if (debug)
		{
			//console.log("float:", r0f, r1f, t0f * 180 / Math.PI, t1f * 180 / Math.PI);
			//console.log("int:", r0, r1, t0, t1);
			//console.log("val:", val / area, "val * max:", val * lMax / area);
		}
	}
	list.sort(function(a, b)
	{
		return b[1] - a[1]; // b - a: maior valor primeiro; a - b: menor valor primeiro
	});

	if (depth > 1)
	{
		switch (list[0][2])
		{
			case 0:
			case 1:
			case 4:
				theta += beta / 4;
				break;

			case 2:
			case 3:
			case 6:
				theta -= beta / 4;
				break;
		}
	}
	else
		theta = list[0][2] * Math.PI / (extra ? 4 : 2) + Math.PI / 4;
	path.push([list[0][7], list[0][8], list[0][9], list[0][10]]);
//	path.push([parseInt(list[0][3]), parseInt(list[0][4]), parseInt(list[0][5]), parseInt(list[0][6]), depth]);

	if (debug)
		drawCap(map, ni, nj, rec, maxRec, depth, subMax, ogAlpha, path);

	if (depth >= subMax)// || prev > res[list[0][1]]) // se nao houver candidato melhor que o anterior
	{
		return [list[0][0], list[0][3], list[0][4], path, list[0][1], depth - 1];
		if (res[list[0][1]] > best) // se o melhor candidato for melhor que o inicial
			return [(depth >= subMax ? list[0][0] : p0), list[0][3], list[0][4], path, list[0][1], depth - 1];
		else
			return [v0, 0, 0, [], 0, depth - 1];
	}
	else
		return searchWithinCap(extra, best, mask, subMax, map, ii, jj, ni, nj, ori, v0, debug, rec, maxRec, opAlpha, ogAlpha, alpha / 2, beta / 2, theta, list[0][0], res[list[0][2]], depth + 1, path);
}


function getRenderValue(v0, v1, mask)
{
	var w  = renderer.domElement.clientWidth;
	var h  = renderer.domElement.clientHeight;
	var cw = (w > h) ? Math.floor((w / h) * 256) : 256;
	var ch = (h > w) ? Math.floor((h / w) * 256) : 256;
	var pw = Math.floor((cw - 256) / 2);
	var ph = Math.floor((ch - 256) / 2);
	var padw = (w > h) ? Math.floor((w - h) / 2.0) : 0;
	var padh = (h > w) ? Math.floor((h - w) / 2.0) : 0;

	var canvas = createCanvas(1920, 1080);
	canvas.width  = cw;
	canvas.height = ch;
	var ctx = canvas.getContext("2d", {willReadFrequently: true});
	ctx.fillStyle = "white";

	light.position.set(v1.x, v1.y, v1.z);
	emptyObj.position.set(v0.x, v0.y, v0.z);
	rend.render(mainScene, camera);
	ctx.fillRect(0, 0, cw, ch);
	ctx.drawImage(rend.domElement, 0, 0, w, h, 0, 0, cw, ch);
	var c00 = 0;
	var c01 = 0;
	var c10 = 0;
	var c11 = 0;
	var img = ctx.getImageData(pw, ph, 256, 256);
	for (var j = 0; j < 65536; j++)
	{
		var c = (img.data[j * 4] == 255) ? 1 : 0;
		if (c == 0 && mask[j] == 0)
			c00++;
		else if (c == 0 && mask[j] == 1)
			c01++;
		else if (c == 1 && mask[j] == 0)
			c10++;
		else
			c11++;
	}

	var img1, img2;
	if (w > h)
	{
		img1 = ctx.getImageData(0, 0, pw, 256);
		img2 = ctx.getImageData(cw - pw, 0, pw, 256);
		n = pw * 256;
	}
	else
	{
		img1 = ctx.getImageData(0, 0, 256, ph);
		img2 = ctx.getImageData(0, ch - ph, 256, ph);
		n = ph * 256;
	}
	for (var j = 0; j < n; j++)
	{
		if (img1.data[j * 4] == 0)
			c01++;
		if (img2.data[j * 4] == 0)
			c01++;
	}

	var val = 0;
	var uni = c00 + c01 + c10;
	var ins = c00;
	if (uni > 0)
		val = parseFloat(ins) / parseFloat(uni);
	return val;
}


function colorScale(val, minVal, maxVal)
{
	var r, g, b, color = (val - minVal) / (maxVal - minVal);
	if (color <= 0.25)
	{
		r =   0;
		g = 255 * color * 4;
		b = 255;
	}
	else if (color <= 0.5)
	{
		r =   0;
		g = 255;
		b = 255 - 255 * (color - 0.25) * 4;
	}
	else if (color <= 0.75)
	{
		r = 255 * (color - 0.5) * 4;
		g = 255;
		b =   0;
	}
	else
	{
		r = 255;
		g = 255 - 255 * (color - 0.75) * 4;
		b =   0;
	}
	r = Math.floor(r).toString(16);
	g = Math.floor(g).toString(16);
	b = Math.floor(b).toString(16);
	if (r.length == 1)
		r = "0" + r;
	if (g.length == 1)
		g = "0" + g;
	if (b.length == 1)
		b = "0" + b;
	return "#" + r + g + b;
}


function drawCap(ii, nr, nt, rec, maxRec, div, maxDiv, alpha, path = [], pxRes = 4)
{
	var minVal = 1;
	var maxVal = 0;
	for (var i = 0; i < nr; i++)
	{
		for (var j = 0; j < nt; j++)
		{
			var val = ii[i][j][1];
			if (minVal > val)
				minVal = val;
			if (maxVal < val)
				maxVal = val;
		}
	}
	var canvas = createCanvas(640, 512);
	canvas.width  = 640;
	canvas.height = 512;//732;
	ctx = canvas.getContext("2d");
	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, 640, 732);
	for (var i = 0; i < nr; i++)
	{
		for (var j = 0; j < nt; j++)
		{
			{
				ctx.fillStyle = colorScale(ii[i][j][1], minVal, maxVal);
				ctx.fillRect(ii[i][j][2] * 240 + 256, ii[i][j][3] * 240 + 256, pxRes, pxRes);
			}
		}
	}
	for (var i = 0; i < nr; i++)
	{
		for (var j = 0; j < nt; j++)
		{
			ctx.lineWidth = 2;
			ctx.strokeStyle = "#000000";
			var rho, theta;
			for (var i = 0; i < path.length; i++)
			{
				var r0 = Math.max(path[i][0] * 240, 0);
				var r1 = Math.max(path[i][1] * 240, 0);
				var t0 = -path[i][2];
				var t1 = -path[i][3];
				//console.log(x, y, r, a * 180 / Math.PI);
				ctx.beginPath();
				ctx.moveTo(r0 * Math.cos(t0) + 258, r0 * Math.sin(t0) + 258);
				ctx.lineTo(r1 * Math.cos(t0) + 258, r1 * Math.sin(t0) + 258);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(r0 * Math.cos(t1) + 258, r0 * Math.sin(t1) + 258);
				ctx.lineTo(r1 * Math.cos(t1) + 258, r1 * Math.sin(t1) + 258);
				ctx.stroke();
				ctx.beginPath();
				ctx.arc(258, 258, r0, t1, t0, false);
				ctx.stroke();
				ctx.beginPath();
				ctx.arc(258, 258, r1, t1, t0, false);
				ctx.stroke();
			}
			var x, y;
			if (path.length > 0)
			{
				var r = (path[path.length - 1][0] + path[path.length - 1][1]) / 2;
				var t = (path[path.length - 1][2] + path[path.length - 1][3]) / 2;
				x = 240 * r * Math.cos(t) + 256;
				y = 240 * r * Math.sin(-t) + 256;
				ctx.strokeStyle = colorScale(ii[Math.max(Math.min(Math.floor(r * nr), nr - 1), 0)][Math.max(Math.min(Math.floor(t * nt / (Math.PI * 2)), nt - 1), 0)][1], minVal, maxVal);
			}
			else
			{
				x = 256;
				y = 256;
				ctx.strokeStyle = colorScale(ii[0][0][1], minVal, maxVal);
			}
			ctx.beginPath();
			ctx.lineWidth = 6;
			ctx.arc(x, y, 3, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.lineWidth = 2;
			ctx.strokeStyle = "#ffffff";
			ctx.arc(x, y, 6, 0, Math.PI * 2);
			ctx.stroke();
			for (var i = 0; i < nr; i++)
			{
				for (var j = 0; j < nt; j++)
				{
					if (ii[i][j][1] == maxVal)
					{
						ctx.beginPath();
						ctx.lineWidth = 6;
						ctx.strokeStyle = "#ff0000";
						ctx.arc(ii[i][j][2] * 240 + 258, ii[i][j][3] * 240 + 258, 3, 0, Math.PI * 2);
						ctx.stroke();
						ctx.beginPath();
						ctx.lineWidth = 2;
						ctx.strokeStyle = "#ffffff";
						ctx.arc(ii[i][j][2] * 240 + 258, ii[i][j][3] * 240 + 258, 6, 0, Math.PI * 2);
						ctx.stroke();
					}
				}
			}
			/*
			ctx.beginPath();
			ctx.lineWidth = 6;
			ctx.strokeStyle = "#ffffff";
			ctx.arc(ii[res[1]][res[2]][2] * 240 + 258, ii[res[1]][res[2]][3] * 240 + 258, 3, 0, Math.PI * 2);
			ctx.stroke();
			*/
			for (var i = 62; i <= 450; i++)
			{
				ctx.fillStyle = colorScale(i, 62, 450);
				ctx.fillRect(550, 512 - i, 20, 1);
			}
			var mv = ii[0][0][1];
			ctx.font = "bolder 14px Courier New";
			ctx.fillStyle = "#ff0000";
			ctx.fillText(maxVal.toFixed(3), 550,  32);
			ctx.fillStyle = "#0088ff";
			ctx.fillText(minVal.toFixed(3), 550, 480);
			ctx.fillStyle = colorScale(mv, minVal, maxVal);//"#ff73a4";
			ctx.fillText(mv.toFixed(3), 580, 512 - 450 * ((mv - minVal) / (maxVal - minVal)));
			ctx.fillText("initial",     580, 532 - 450 * ((mv - minVal) / (maxVal - minVal)));
			ctx.fillText("est.",        580, 552 - 450 * ((mv - minVal) / (maxVal - minVal)));
/*
			var element = document.createElement('a');
			element.style.display = 'none';
			// nome_abertura_divisoes_recursoes_ncalota_nsubdivisao
			element.setAttribute('download', "p" + (fc < 8 ? "0" : "") + (fc + 1).toString() + "_" + (alpha * 180 / Math.PI).toFixed(3) + "_" + maxRec.toString() + "_" + maxDiv.toString() + "_" + rec.toString() + "_" + div.toString() + ".png");
			element.setAttribute('href', canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
			document.body.appendChild(element);
			element.click();
			document.body.removeChild(element);
*/
		}
	}
}


function beginUserInput(debug = true, preset = 0)
{
	var list = inpt.split(" ");

	console.log("Start!");

	vObj.visible         = false;
	vObjMask.visible     = true;
	wPlane.visible       = true;

	// list, debug, threshold, rho, theta, alpha, recMax, subMax
	if (preset == 0)
		beginMethod(list, debug, -1, 65, 257, 6, 1, 4);
	else
		beginMethod(list, debug, 10, 129, 513, 6, preset, 4);
/*
	for (var i = 1; i <= 3; i++)
		for (var j = 1; j <= 3; j++)
			for (var k = 1; k <= 3; k++)
				beginMethod(list, debug, 10, 257, 513, i * 3, j, k);
*/
	vObj.visible         = true;
	vObjMask.visible     = false;
	wPlane.visible       = false;
}


function update()
{
	vObjMask.position.set(vObj.position.x, vObj.position.y, vObj.position.z);

	// update artoolkit every frame
	if (arToolkitSource.ready !== false)
		arToolkitContext.update(arToolkitSource.domElement);
}
