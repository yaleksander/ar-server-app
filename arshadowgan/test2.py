import sys
import os
import os.path as osp
import cv2 as cv
import numpy as np
import tensorflow as tf
import imutils

from skimage.metrics import structural_similarity as compare_ssim
from pathlib import Path

source_path = Path(__file__).resolve()
source_dir = source_path.parent
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['CUDA_VISIBLE_DEVICES'] = '0'
node_names = {'input_image':      'placeholder/input_image:0',
              'input_mask':       'placeholder/input_mask:0',
              'output_attention': 'concat_1:0',
              'output_image':     'Tanh:0'}
data_root = osp.join(source_dir, 'data')
output_dir = osp.join(source_dir, 'output')


def read_image(image_path, channels):
	image = cv.imread(image_path, cv.IMREAD_COLOR)
	if channels == 3:
		image = cv.imread(image_path, cv.IMREAD_COLOR)
	else:
		image = cv.imread(image_path, cv.IMREAD_GRAYSCALE)
		image = np.expand_dims(image, 2)
	image = image.astype(np.float32) / 127.5 - 1.0
	return image


def test():
	if not osp.exists(data_root):
		print("No data directory")
		exit(0)

	model_pb = osp.join(source_dir, 'model', 'model.pb')
	if not osp.exists(model_pb):
		print("No pre-trained model")
		exit(0)

	if not osp.exists(output_dir):
		os.makedirs(output_dir)

	#file = open(osp.join(output_dir, "contours.txt"), "w") # custom code

	config = tf.compat.v1.ConfigProto()
	config.gpu_options.allow_growth = True
	with tf.compat.v1.Session(config=config) as sess:

		with tf.io.gfile.GFile(model_pb, 'rb') as f:
			graph_def = tf.compat.v1.GraphDef()
			graph_def.ParseFromString(f.read())
			sess.graph.as_default()
			tf.import_graph_def(graph_def, name='')

		sess.run(tf.compat.v1.global_variables_initializer())

		input_image      = sess.graph.get_tensor_by_name(node_names['input_image'])
		input_mask       = sess.graph.get_tensor_by_name(node_names['input_mask'])
		output_attention = sess.graph.get_tensor_by_name(node_names['output_attention'])
		output_image     = sess.graph.get_tensor_by_name(node_names['output_image'])

		image_list  = sorted(os.listdir(osp.join(data_root, 'noshadow')))
		image_batch = np.zeros((1, 256, 256, 3))
		mask_batch  = np.zeros((1, 256, 256, 1))

		for i in image_list:
			image_batch[0] = read_image(osp.join(data_root, 'noshadow', i), 3)
			mask_batch[0]  = 0 - read_image(osp.join(data_root, 'mask', i), 1)

			feed_dict = {input_image: image_batch,
			             input_mask:  mask_batch}

			image, attention = sess.run([output_image, output_attention], feed_dict=feed_dict)
			image = ((1.0 + image) * 127.5).astype(np.uint8)
			object_attention = (attention[0, :, :, 0] * 255.0).astype(np.uint8)
			shadow_attention = (attention[0, :, :, 1] * 255.0).astype(np.uint8)

			cv.imwrite(osp.join(output_dir, i), image[0])
			cv.imwrite(osp.join(output_dir, 'object_' + i), object_attention)
			cv.imwrite(osp.join(output_dir, 'shadow_' + i), shadow_attention)

			# custom code
			mask = read_image(osp.join(data_root, 'mask', i), 1)
			g1 = cv.cvtColor(image[0], cv.COLOR_BGR2GRAY)
			g2 = cv.cvtColor(((1.0 + image_batch) * 127.5).astype(np.uint8)[0], cv.COLOR_BGR2GRAY)
			score, diff = compare_ssim(g1, g2, full=True)
			diff = (diff * 255).astype(np.uint8)
			#print("SSIM for image {}: {}".format(i, score))
			diff = cv.subtract(mask.astype(np.uint8), diff)
			#diff = cv.GaussianBlur(diff, (7, 7), 0)
			#cv.fastNlMeansDenoising(diff, diff, 70)
			#ret, diff = cv.threshold(diff, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
			ret, obj = cv.threshold(object_attention, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
			ret, sha = cv.threshold(shadow_attention, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
			diff = cv.subtract(diff, obj.astype(np.uint8))
			diff = cv.subtract(diff, sha.astype(np.uint8))
			ret, otsu = cv.threshold(diff, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
			cnts = cv.findContours(otsu, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
			cnts = imutils.grab_contours(cnts)
			diff = cv.cvtColor(diff, cv.COLOR_GRAY2RGB)
			greatest = 0
			cnt = None
			for c in cnts:
				cv.drawContours(diff, [c], -1, (255, 0, 0), 1) # desenha o contorno (linha) detectado na imagem original
				dm = np.zeros(otsu.shape, np.uint8)            # cria imagem vazia com o mesmo tamanho e mesma quantidade de canais que 'otsu'
				cv.drawContours(dm, [c], -1, 255, -1)          # desenha o contorno (area) detectado na nova imagem vazia
				#mean = cv.mean(diff, mask = dm)[0]             # adquire a intensidade media dos pixels dentro do contorno desenhado
				area = cv.contourArea(c)
				mean = cv.mean(diff, mask = dm)[0] * area      # adquire a soma da intensidade dos pixels dentro do contorno desenhado
				if (mean > greatest):                          # guarda o contorno com maior intensidade media
					greatest = mean
					cnt = c
			if (cnt is not None):                              # se foi encontrado ao menos 1 contorno, desenha um circulo vermelho no centro
				#M = cv.moments(cnt)
				#x = int(M["m10"] / M["m00"])
				#y = int(M["m01"] / M["m00"])
				#cv.circle(diff, (x, y), 3, (0, 0, 255), -1)
				cp = diff.copy()
				cv.drawContours(diff, [cnt], -1, (0, 255, 0), 1)
				cv.drawContours(cp, [cnt], -1, (0, 255, 0), -1)
				mask = 255 - read_image(osp.join(data_root, 'mask', i), 1).astype(np.uint8)
				ret, m = cv.threshold(mask, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
				cm = cv.findContours(m, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
				cm = imutils.grab_contours(cm)

				dm = np.zeros(otsu.shape, np.uint8)
				cv.drawContours(dm, cnt, -1, 255, 1)
				#cv.drawContours(dm, cm, -1, 0, 3)
				x = 0
				y = 0
				p = 0
				for j in range(0, dm.shape[0] - 1):
					for k in range(0, dm.shape[1] - 1):
						if (dm[j, k] == 255):
							p += 1
							x += j
							y += k
				if (p == 0):
					x = -1
					y = -1
				else:
					aux = x // p
					x = y // p
					y = aux

				#print (x, y)
				#cv.drawContours(diff, cm, -1, (255, 0, 0), 5)
				cv.circle(diff, (x, y), 3, (0, 0, 255), -1)
			else:                                              # se nao foi encontrado nenhum contorno, nao desenha nada e anota x e y como negativos (erro)
				x = -1
				y = -1
			s = str(x) + " " + str(y) + " "
			for j in range(256):
				for k in range(256):
					if (cp[k, j, 0] == 0 and cp[k, j, 1] == 255 and cp[k, j, 2] == 0):
						s += str(j) + " " + str(k) + " "
			print(s[:-1])
			#file.write(s[:-1] + "\n")
			cv.imwrite(osp.join(output_dir, 'contours_' + i), diff)
	#file.close()


if __name__ == '__main__':
	test()
