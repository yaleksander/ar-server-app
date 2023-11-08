import os
import numpy as np

root_dir = ".\\"#""C:\\xampp\\htdocs\\stemkoski\\my-images\\contours\\"
prefixes = ["arshadowgan", "pictures"]

for pre in prefixes:
	es_file = open(root_dir + pre + "_estimated.txt", "r")
	gt_file = open(root_dir + pre + "_ground_truth.txt", "r")
	res_file = open(root_dir + pre + "_similarity.txt", "w")
	es_list = es_file.read().split("\n")
	gt_list = gt_file.read().split("\n")

	for i in range(len(es_list)):
		if (not es_list[i]):
			continue
		es = np.zeros((256, 256))
		gt = np.zeros((256, 256))
		k = es_list[i].split()
		for j in range(0, len(k), 2):
			es[int(k[j]), int(k[j + 1])] = 1
		k = gt_list[i].split()
		for j in range(0, len(k), 2):
			gt[int(k[j]), int(k[j + 1])] = 1

		c00 = 0
		c01 = 0
		c10 = 0
		c11 = 0
		for i in range(256):
			for j in range(256):
				if (es[i, j] == 0 and gt[i, j] == 0):
					c00 += 1
				elif (es[i, j] == 0 and gt[i, j] == 1):
					c01 += 1
				elif (es[i, j] == 1 and gt[i, j] == 0):
					c10 += 1
				else:
					c11 += 1
		res_file.write(str(float(c11) / float(c11 + c01 + c10)) + "\n")

	es_file.close()
	gt_file.close()
	res_file.close()
