const THREE = require("three-canvas-renderer");
const gl = require("gl");
const {createCanvas, loadImage} = require("canvas");

console.log(initialize(process.argv[2].split(" "), process.argv[3]));


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


function initialize(contour, params)
{
	// variaveis globais
	const vObjHeight =   1.20;
	const vObjRatio  =   1.00;
	const adjustX    =   0.00;
	const adjustZ    =   0.00;
	const planeSize  = 150.00;

	// cenas e iluminacao
	var mainScene = new THREE.Scene();
	var scene = new THREE.Group();
	mainScene.add(scene);
	var camera = new THREE.PerspectiveCamera(90, 1, 0.1, 1000);
	mainScene.add(camera);

	// materiais e texturas
	var maskMat = new THREE.MeshBasicMaterial({
		color: 0xffffff,
		side: THREE.DoubleSide
	});
	var shadowMat = new THREE.MeshBasicMaterial({
		color: 0x000000,
		side: THREE.DoubleSide
	});

	// geometrias
	var cube = new THREE.BoxGeometry(vObjHeight, vObjHeight * vObjRatio, vObjHeight);
	var planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
	var bufGeo = new THREE.BufferGeometry();
	var vertices = [];
	for (var i = 0; i < 8 * 3; i++)
		vertices.push(0);
	bufGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
	var indices = [];
	for (var i = 0; i < 8; i++)
		for (var j = i + 1; j < 8; j++)
			for (var k = j + 1; k < 8; k++)
				indices.push(i, j, k);
	bufGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));

	// objetos 3D
	var vObj = new THREE.Mesh(cube, maskMat);
	var fakeShadow = new THREE.Mesh(bufGeo, shadowMat);
	var plane = new THREE.Mesh(planeGeo, maskMat);

	// ajustes de posicao, rotacao, etc.
	vObj.position.set(adjustX, vObjRatio * vObjHeight / 2, adjustZ);
	plane.rotation.x = -Math.PI / 2;
	plane.visible = false;
	scene.add(fakeShadow);
	scene.add(vObj);
	scene.add(plane);

	// ajuste de parametros, etc.
	params = params.split(" ");
	var p = new THREE.Matrix4();
	for (var i = 0; i < 16; i++)
	{
		p.elements[i] = parseFloat(params[i]);
		camera.projectionMatrix.elements[i] = parseFloat(params[i + 16]);
		camera.projectionMatrixInverse.elements[i] = parseFloat(params[i + 32]);
	}
	const rendW = parseInt(params[48]);
	const rendH = parseInt(params[49]);
	const preset = parseInt(params[50]);
	scene.applyMatrix4(p);
	scene.updateMatrix(true);
	scene.updateMatrixWorld(true);
	camera.updateMatrixWorld(true);

	// canvas e renderer
	const canvas = createCanvas(rendW, rendH);
	canvas.addEventListener = (type, handler) => {};
	canvas.removeEventListener = (type) => {};
	const renderer = new THREE.WebGLRenderer(
	{
		canvas: canvas,
		powerPreference: "high-performance",
		context: gl(rendW, rendH,
		{
			preserveDrawingBuffer: true
		})
	});
	renderer.setClearColor(0xffffff);
	const renderTarget = new THREE.WebGLRenderTarget(rendW, rendH,
	{
		minFilter: THREE.LinearFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.UnsignedByteType,
	});
	renderer.setRenderTarget(renderTarget);
	var output = new Uint8Array(rendW * rendH * 4);

	// resultado para o node
	var result = "0 1 0";
	switch (preset)
	{
		case 1:
			result = beginMethod(true, contour, 10, 33, 65, 22, 1, 3, camera, mainScene, scene, vObj, fakeShadow, plane, adjustX, adjustZ, preset, rendW, rendH, renderer, output, vObjHeight, vObjRatio, planeSize);
			break;

		case 2:
			result = beginMethod(true, contour, 10, 33, 65, 22, 2, 3, camera, mainScene, scene, vObj, fakeShadow, plane, adjustX, adjustZ, preset, rendW, rendH, renderer, output, vObjHeight, vObjRatio, planeSize);
			break;

		default:
			result = beginMethod(true, contour, 10, 33, 65, 22, 0, 3, camera, mainScene, scene, vObj, fakeShadow, plane, adjustX, adjustZ, preset, rendW, rendH, renderer, output, vObjHeight, vObjRatio, planeSize);
	}
	return result;
}


function beginMethod(div, list, threshold, rho, theta, alpha, recMax, subMax, camera, mainScene, scene, vObj, fakeShadow, plane, adjustX, adjustZ, preset, rendW, rendH, renderer, output, vObjHeight, vObjRatio, planeSize)
{
	var startTime = performance.now();

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
		v1[i].add(vObj.position);

	var w    = rendW;
	var h    = rendH;
	var padw = (w > h) ? Math.floor((w - h) / 2.0) : 0;
	var padh = (h > w) ? Math.floor((h - w) / 2.0) : 0;
	var m    = ((w > h) ? h : w) / 256.0;

	renderer.render(mainScene, camera);//renderer.readRenderTargetPixels(renderer.getRenderTarget(), 0, 0, rendW, rendH, output);
	var ray = new THREE.Raycaster();
	var k = 0;
	while (k < list.length)//2
	{
		var x = parseInt(list[k++]) * m + padw;
		var y = parseInt(list[k++]) * m + padh;
		var p = new THREE.Vector2((x / w) * 2 - 1, 1 - (y / h) * 2);
		ray.setFromCamera(p, camera);
		var intersect = ray.intersectObject(plane);
		if (intersect.length > 0)
			v2.push(new THREE.Vector3((intersect[0].uv.x - 0.5) * planeSize + plane.position.x, plane.position.y, (0.5 - intersect[0].uv.y) * planeSize + plane.position.z));
		if (recMax == 0)
			break;
	}

	var result;
	if (recMax > 0)
	{
		// reduz o tamanho da segunda lista
		for (var i = 0; i < v2.length - 1; i++)
			for (var j = i + 1; j < v2.length; j++)
				if (v2[i].distanceTo(v2[j]) < threshold)
					v2.splice(j--, 1);

		// liga os pontos
		for (var i = 0; i < v1.length; i++)
		{
			for (var j = 0; j < v2.length; j++)
			{
				var aux = v1[i].clone().sub(v2[j].clone());
				var v = aux.clone().normalize().multiplyScalar(3 * vObjRatio * vObjHeight).add(v1[i].clone()); // quanto maior o escalar, mais longe fica a fonte de luz
				v3.push([v1[i], v2[j], v, aux, Math.atan2(aux.z, aux.x) * 180 / Math.PI + 180]);
			}
		}

		// ordena a lista
		v3.sort(function(a, b)
		{
			return a[4] - b[4];
		});

		var mask = [];
		for (var i = 0; i < 65536; i++)
			mask.push(1);
		for (var i = 0; i < list.length; i += 2)
			mask[parseInt(list[i]) + parseInt(list[i + 1]) * 256] = 0;

		var mi = 0, mv = 0;

		for (k = 0; k < v3.length; k++)
		{
			var val = getRenderValue(v3[k][1], v3[k][2], mask, camera, mainScene, scene, vObj, fakeShadow, plane, adjustX, adjustZ, preset, rendW, rendH, renderer, output, vObjHeight, vObjRatio, planeSize);
			if (val > mv)
			{
				mv = val;
				mi = k;
			}
		}

		k = mi;

		var v5 = v3[k][2].clone().sub(v3[k][1]).normalize();
		alpha *= Math.PI / 180;
		result = mainMethod(camera, mainScene, scene, vObj, fakeShadow, plane, adjustX, adjustZ, preset, rendW, rendH, renderer, output, vObjHeight, vObjRatio, planeSize, div, mask, mv, v5.normalize(), v3[k][1], alpha, alpha, v3.length, rho, theta, subMax, recMax);
	}
	else
	{
		var v = (vObj.position.clone().sub(v2[0].clone())).normalize().multiplyScalar(3 * vObjRatio * vObjHeight).add(vObj.position);
		result = v.x.toString() + " " + v.y.toString() + " " + v.z.toString();
	}

	var endTime = performance.now();
	var dt = endTime - startTime;
	var minutes = Math.floor(dt / 60000);
	var seconds = Math.floor((dt - minutes * 60000) / 1000);
	var miliseconds = dt - minutes * 60000 - seconds * 1000;

	return result;
}


function mainMethod(camera, mainScene, scene, vObj, fakeShadow, plane, adjustX, adjustZ, preset, rendW, rendH, renderer, output, vObjHeight, vObjRatio, planeSize, div, mask, mv, initialVector, objectPosition, alpha, opAlpha, v3len, rho = 257, theta = 257, subMax = 1, recMax = 1, depth = 1)
{
	var v5 = initialVector.normalize();

	// cria o mapa
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
		vl.push([]);
		for (var j = 0; j < nj; j++)
		{
			v8.applyAxisAngle(v5, sj);
			var v9 = v8.clone().multiplyScalar(5).add(objectPosition);
			var renderVal = getRenderValue(objectPosition, v9, mask, camera, mainScene, scene, vObj, fakeShadow, plane, adjustX, adjustZ, preset, rendW, rendH, renderer, output, vObjHeight, vObjRatio, planeSize);
			vl[i].push([v9, renderVal, (i / ni) * Math.cos(j * sj), (i / ni) * Math.sin(j * sj) * -1, 0]);
			if (renderVal > maxRenderVal)
			{
				maxVec = v9;
				maxRenderVal = renderVal;
			}
		}
	}

	if (depth < recMax)
	{
		// calcula a imagem integral
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
		var res = searchWithinCap(div, mv, mask, subMax, vl, si, sj, ni, nj, objectPosition, v5, depth, recMax, alpha, opAlpha, alpha);

		var newAlpha = res[6];
		return mainMethod(camera, mainScene, scene, vObj, fakeShadow, plane, adjustX, adjustZ, preset, rendW, rendH, renderer, output, vObjHeight, vObjRatio, planeSize, div, mask, mv, res[0].clone(), objectPosition, newAlpha, opAlpha, v3len, rho, theta, subMax, recMax, depth + 1);
	}
	else
		return maxVec.x.toString() + " " + maxVec.y.toString() + " " + maxVec.z.toString();
}


//
function searchWithinCap(camera, mainScene, scene, vObj, fakeShadow, plane, adjustX, adjustZ, preset, rendW, rendH, renderer, output, vObjHeight, vObjRatio, planeSize, extra, best, mask, subMax, map, ii, jj, ni, nj, ori, v0, rec, maxRec, opAlpha, ogAlpha, alpha, beta = Math.PI, theta = 0, p0 = v0.clone(), prev = 0, depth = 1, path = [])
{
	var p = [];

	if (depth == 1)
	{
		var axis = new THREE.Vector3(0, 1, 0).cross(v0).normalize();
		for (var i = 0; i < (extra ? 8 : 4); i++)
		{
			p.push(p0.clone().applyAxisAngle(axis, alpha / 2));
			p[i].applyAxisAngle(v0, i * Math.PI / (extra ? 4 : 2) + Math.PI / 4);
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
	var dist = [];
	for (var i = 0; i < (extra ? 8 : 4); i++)
		dist.push(p0.angleTo(p[i]));
	var distMax = Math.max(dist[0], dist[1], dist[2], dist[3]);

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
		list.push([p[i], val / area, i, ar, at, mr, mt, r0f, r1f, t0f, t1f]);
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

	if (depth >= subMax)// || prev > res[list[0][1]]) // se nao houver candidato melhor que o anterior
		return [list[0][0], list[0][3], list[0][4], path, list[0][1], depth - 1, distMax];
	else
		return searchWithinCap(camera, mainScene, scene, vObj, fakeShadow, plane, adjustX, adjustZ, preset, rendW, rendH, renderer, output, vObjHeight, vObjRatio, planeSize, extra, best, mask, subMax, map, ii, jj, ni, nj, ori, v0, rec, maxRec, opAlpha, ogAlpha, alpha / 2, beta / 2, theta, list[0][0], res[list[0][2]], depth + 1, path);
}


function getRenderValue(v0, v1, mask, camera, mainScene, scene, vObj, fakeShadow, plane, adjustX, adjustZ, preset, rendW, rendH, renderer, output, vObjHeight, vObjRatio, planeSize)
{
	var w  = rendW;
	var h  = rendH;
	var cw = (w > h) ? Math.floor((w / h) * 256) : 256;
	var ch = (h > w) ? Math.floor((h / w) * 256) : 256;
	var pw = Math.floor((cw - 256) / 2);
	var ph = Math.floor((ch - 256) / 2);
	var padw = (w > h) ? Math.floor((w - h) / 2.0) : 0;
	var padh = (h > w) ? Math.floor((h - w) / 2.0) : 0;

	var canvas = createCanvas(cw, ch);
	var ctx = canvas.getContext("2d", {willReadFrequently: true});
	ctx.fillStyle = "white";

	var p1 = [];
	var p2 = [];
	var position = vObj.geometry.attributes.position;
	p1.push(new THREE.Vector3().fromBufferAttribute(position, 0).add(vObj.position));
	p1.push(new THREE.Vector3().fromBufferAttribute(position, 1).add(vObj.position));
	p1.push(new THREE.Vector3().fromBufferAttribute(position, 4).add(vObj.position));
	p1.push(new THREE.Vector3().fromBufferAttribute(position, 5).add(vObj.position));
	p2.push(new THREE.Vector3().fromBufferAttribute(position, 2).add(vObj.position));
	p2.push(new THREE.Vector3().fromBufferAttribute(position, 3).add(vObj.position));
	p2.push(new THREE.Vector3().fromBufferAttribute(position, 6).add(vObj.position));
	p2.push(new THREE.Vector3().fromBufferAttribute(position, 7).add(vObj.position));
	var dir = (v1.clone().sub(v0)).normalize().multiplyScalar(-1);
	for (var i = 0; i < 4; i++)
	{
		var m1 = p1[i].y / dir.y;
		var m2 = p2[i].y / dir.y;
		p2[i].add(dir.clone().multiplyScalar(-m2));
		p2.push(p1[i].clone().add(dir.clone().multiplyScalar(-m1)));
	}
	for (var i = 0; i < 8; i++)
		fakeShadow.geometry.attributes.position.setXYZ(i, p2[i].x, p2[i].y, p2[i].z);
	fakeShadow.geometry.attributes.position.needsUpdate = true;
	renderer.render(mainScene, camera);
	renderer.readRenderTargetPixels(renderer.getRenderTarget(), 0, 0, w, h, output);
	var img = createCanvas(cw, ch).getContext("2d", {willReadFrequently: true}).getImageData(0, 0, cw, ch);
	for (var i = 0; i < ch; i++)
		for (var j = 0; j < cw; j++)
			for (var k = 0; k < 4; k++)
				img.data[(i * cw + j) * 4 + k] = output[(w * h - parseInt(i * h / ch) * w + parseInt(j * w / cw)) * 4 + k];
	ctx.putImageData(img, 0, 0);

	var c00 = 0;
	var c01 = 0;
	var c10 = 0;
	var c11 = 0;
	var img0 = ctx.getImageData(pw, ph, 256, 256);
	for (var j = 0; j < 65536; j++)
	{
		var c = (img0.data[j * 4] == 255) ? 1 : 0;
		if (c == 0 && mask[j] == 0)
			c00++;
		else if (c == 0 && mask[j] == 1)
			c01++;
		else if (c == 1 && mask[j] == 0)
			c10++;
		else
			c11++;
	}

	if (w != h)
	{
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
	}

	var val = 0;
	var uni = c00 + c01 + c10;
	var ins = c00;
	if (uni > 0)
		val = parseFloat(ins) / parseFloat(uni);
	return val;
}
